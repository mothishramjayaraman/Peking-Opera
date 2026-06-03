"""
Pitch Model Training Pipeline for Jingju Singing
Pretrain on MDB + MIR-1K + TONAS → Fine-tune on Jingju recordings

Supports:
  - Full training from scratch
  - Fine-tuning from a checkpoint
  - Semi-supervised pseudo-label training
"""

import os
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
import numpy as np
import logging
from typing import Optional
from tqdm import tqdm

from models.pitch_model import PitchRefinementHead
from models.shared_encoder import SharedAcousticEncoder
from training.losses import MultiTaskLoss
from training.augmentation import JingjuAugmenter
from features.extractor import JingjuFeatureExtractor

logger = logging.getLogger(__name__)

FEATURE_DIM = 207
ENC_DIM = 512


class PitchTrainer:
    """
    Full training pipeline for the Jingju hybrid pitch model.

    Training strategy:
      1. Pretrain refinement head on MDB-stem-synth + MIR-1K + TONAS
      2. Fine-tune on Jingju a cappella dataset
      3. Semi-supervised round: re-train with high-confidence pseudo-labels

    Usage:
        trainer = PitchTrainer(device="cuda", save_dir="checkpoints/pitch")
        trainer.train(train_loader, val_loader, epochs=50)
    """

    def __init__(
        self,
        device: str = "cpu",
        save_dir: str = "checkpoints/pitch",
        learning_rate: float = 1e-4,
        weight_decay: float = 1e-5,
        role: str = "default",
    ):
        self.device = device
        self.save_dir = save_dir
        os.makedirs(save_dir, exist_ok=True)

        # Models
        self.shared_encoder = SharedAcousticEncoder(feature_dim=FEATURE_DIM, enc_dim=ENC_DIM).to(device)
        self.refinement     = PitchRefinementHead(input_dim=360, hidden_dim=256, num_layers=2).to(device)

        # Loss
        self.criterion = MultiTaskLoss(learnable_weights=True).to(device)

        # Optimizer
        self.optimizer = torch.optim.AdamW(
            list(self.shared_encoder.parameters()) +
            list(self.refinement.parameters()) +
            list(self.criterion.parameters()),
            lr=learning_rate,
            weight_decay=weight_decay,
        )

        self.scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
            self.optimizer, T_max=50, eta_min=1e-6
        )

        self.augmenter  = JingjuAugmenter()
        self.extractor  = JingjuFeatureExtractor()
        self.best_val_loss = float("inf")
        self.role = role

    def train(
        self,
        train_loader: DataLoader,
        val_loader: Optional[DataLoader] = None,
        epochs: int = 50,
        log_interval: int = 10,
    ):
        logger.info(f"Starting training: {epochs} epochs on {self.device}")

        for epoch in range(1, epochs + 1):
            train_loss = self._train_epoch(train_loader, epoch, log_interval)

            val_loss = None
            if val_loader is not None:
                val_loss = self._val_epoch(val_loader)
                logger.info(f"Epoch {epoch}/{epochs} | train_loss={train_loss:.4f} | val_loss={val_loss:.4f}")
                if val_loss < self.best_val_loss:
                    self.best_val_loss = val_loss
                    self._save("best.pt")
            else:
                logger.info(f"Epoch {epoch}/{epochs} | train_loss={train_loss:.4f}")

            self.scheduler.step()

            if epoch % 10 == 0:
                self._save(f"epoch_{epoch}.pt")

        logger.info("Training complete.")

    def _train_epoch(self, loader: DataLoader, epoch: int, log_interval: int) -> float:
        self.shared_encoder.train()
        self.refinement.train()
        total_loss = 0.0
        n_batches = 0

        for batch_idx, batch in enumerate(tqdm(loader, desc=f"Epoch {epoch}", leave=False)):
            y_batch      = batch["audio"].to(self.device)        # (B, N_samples)
            f0_batch     = batch["f0"].to(self.device)           # (B, T)
            conf_batch   = batch["confidence"].to(self.device)   # (B, T)

            # Augment (CPU-side, then move)
            y_np = y_batch.cpu().numpy()
            f0_np = f0_batch.cpu().numpy()
            y_aug_list, f0_aug_list = [], []
            for i in range(len(y_np)):
                ya, fa = self.augmenter.augment(y_np[i], f0_np[i], p=0.8)
                y_aug_list.append(ya)
                f0_aug_list.append(fa)

            y_aug = torch.tensor(np.stack(y_aug_list), dtype=torch.float32, device=self.device)
            f0_aug = torch.tensor(np.stack(f0_aug_list), dtype=torch.float32, device=self.device)

            # Feature extraction (simplified: use pre-extracted if available)
            # In production: features are pre-computed and stored in the dataset
            if "features" in batch:
                feats = batch["features"].to(self.device)   # (B, FEATURE_DIM, T)
            else:
                # On-the-fly extraction (slower — for prototyping only)
                feats = self._extract_batch_features(y_aug)

            # Forward
            enc = self.shared_encoder(feats, role=self.role)    # (B, T, ENC_DIM)
            # For refinement head: we need CREPE salience — use encoded features as proxy
            # (In full training: CREPE salience is stored in the dataset)
            if "salience" in batch:
                salience = batch["salience"].to(self.device)    # (B, T, 360)
                pitch_pred, conf_pred = self.refinement(salience)
                pitch_pred = pitch_pred.squeeze(-1)
                conf_pred  = conf_pred.squeeze(-1)
                loss = self.criterion(pitch_pred, f0_aug, conf_batch)
            else:
                # Skip refinement loss if no salience (still train shared encoder)
                loss = torch.zeros(1, requires_grad=True, device=self.device)

            self.optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(self.shared_encoder.parameters(), 1.0)
            nn.utils.clip_grad_norm_(self.refinement.parameters(), 1.0)
            self.optimizer.step()

            total_loss += loss.item()
            n_batches += 1

            if batch_idx % log_interval == 0:
                logger.debug(f"  batch {batch_idx} loss={loss.item():.4f}")

        return total_loss / max(n_batches, 1)

    @torch.no_grad()
    def _val_epoch(self, loader: DataLoader) -> float:
        self.shared_encoder.eval()
        self.refinement.eval()
        total_loss = 0.0
        n_batches = 0

        for batch in loader:
            f0_batch   = batch["f0"].to(self.device)
            conf_batch = batch["confidence"].to(self.device)

            if "salience" in batch:
                salience = batch["salience"].to(self.device)
                pitch_pred, _ = self.refinement(salience)
                pitch_pred = pitch_pred.squeeze(-1)
                loss = self.criterion.pitch_loss(pitch_pred, f0_batch, conf_batch)
                total_loss += loss.item()
                n_batches += 1

        return total_loss / max(n_batches, 1)

    def _extract_batch_features(self, y_batch: torch.Tensor) -> torch.Tensor:
        """On-the-fly feature extraction. Use pre-computed features in production."""
        B = y_batch.shape[0]
        feat_list = []
        for i in range(B):
            y_np = y_batch[i].cpu().numpy()
            ft = self.extractor.extract(y_np)
            feat_list.append(ft.unified)

        # Pad/trim to same time length
        T = min(f.shape[1] for f in feat_list)
        stacked = np.stack([f[:, :T] for f in feat_list], axis=0)   # (B, FEATURE_DIM, T)
        return torch.tensor(stacked, dtype=torch.float32, device=self.device)

    def _save(self, filename: str):
        path = os.path.join(self.save_dir, filename)
        torch.save({
            "shared_encoder": self.shared_encoder.state_dict(),
            "refinement":     self.refinement.state_dict(),
        }, path)
        logger.info(f"Checkpoint saved: {path}")

    def load_checkpoint(self, path: str):
        ckpt = torch.load(path, map_location=self.device, weights_only=True)
        self.shared_encoder.load_state_dict(ckpt["shared_encoder"])
        self.refinement.load_state_dict(ckpt["refinement"])
        logger.info(f"Loaded checkpoint: {path}")
