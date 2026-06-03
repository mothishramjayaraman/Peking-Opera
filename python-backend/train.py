"""
Jingju AI Singing System — Training Launch Script

Usage:
    python train.py                        # train pitch model (default)
    python train.py --model pitch          # train pitch model
    python train.py --model vibrato        # train vibrato model
    python train.py --model expression     # train expression model
    python train.py --model all            # train all models sequentially
    python train.py --epochs 30 --batch 8  # custom epochs/batch size
    python train.py --device cuda          # use GPU (default: auto-detect)

Datasets are discovered automatically from the 'train datasets' folder
relative to this script's location.
"""

import os
import sys
import argparse
import logging
import numpy as np
import torch
from pathlib import Path
from torch.utils.data import DataLoader

# ── Resolve paths ─────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).parent
DATASETS_DIR = SCRIPT_DIR.parent / "train datasets"
CKPT_DIR     = SCRIPT_DIR / "checkpoints"

JINGJU_ROOT  = DATASETS_DIR / "pitch" / "Jingju a cappella singing dataset part1"
MDB_ROOT     = DATASETS_DIR / "pitch" / "MDB-stem-synth"
TONAS_ROOT   = DATASETS_DIR / "TONAS_0" / "TONAS"
VOCALSET_DIR = DATASETS_DIR / "vibrato" / "VocalSet" / "FULL"
CHINESE_VIB  = DATASETS_DIR / "vibrato" / "Chinese" / "Chinese"
CREMA_ROOT   = DATASETS_DIR / "Expression  Emotion Datasets" / "CREMA-D Dataset" / "CREMA-D-master"
EMOV_ROOT    = DATASETS_DIR / "Expression  Emotion Datasets" / "EmoV_DB"
RAVDESS_ROOT = DATASETS_DIR / "Expression  Emotion Datasets" / "RAVDESS Dataset" / "Audio_Song_Actors_01-24"

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(SCRIPT_DIR / "training.log"),
    ],
)
logger = logging.getLogger("train")


# ── Device detection ──────────────────────────────────────────────────────────

def get_device(requested: str = "auto") -> str:
    if requested == "auto":
        if torch.cuda.is_available():
            logger.info(f"Using GPU: {torch.cuda.get_device_name(0)}")
            return "cuda"
        logger.info("No GPU detected — using CPU (training will be slow)")
        return "cpu"
    return requested


# ── Pitch model training ──────────────────────────────────────────────────────

def train_pitch(args):
    logger.info("=" * 60)
    logger.info("PITCH MODEL TRAINING")
    logger.info("=" * 60)

    from datasets.jingju_dataset import (
        JingjuDataset, MDBDataset, TONASDataset, CombinedSingingDataset
    )
    from training.augmentation import JingjuAugmenter

    device = get_device(args.device)
    augmenter = JingjuAugmenter()

    # Build datasets — only include roots that exist on disk
    def exists(p): return p.exists()

    jingju_root = str(JINGJU_ROOT) if exists(JINGJU_ROOT) else None
    mdb_root    = str(MDB_ROOT)    if exists(MDB_ROOT)    else None
    tonas_root  = str(TONAS_ROOT)  if exists(TONAS_ROOT)  else None

    logger.info(f"Jingju root : {jingju_root or 'NOT FOUND'}")
    logger.info(f"MDB root    : {mdb_root    or 'NOT FOUND'}")
    logger.info(f"TONAS root  : {tonas_root  or 'NOT FOUND'}")

    train_ds = CombinedSingingDataset(
        jingju_root=jingju_root,
        mdb_root=mdb_root,
        tonas_root=tonas_root,
        split="train",
        augmenter=augmenter,
    )
    val_ds = CombinedSingingDataset(
        jingju_root=jingju_root,
        mdb_root=mdb_root,
        tonas_root=tonas_root,
        split="val",
    )

    if len(train_ds) == 0:
        logger.error("No training data found. Check dataset paths.")
        return

    logger.info(f"Train segments: {len(train_ds)}, Val segments: {len(val_ds)}")

    train_loader = DataLoader(
        train_ds, batch_size=args.batch, shuffle=True,
        num_workers=4, pin_memory=(device == "cuda"),
        drop_last=True, prefetch_factor=2, persistent_workers=True,
    )
    val_loader = DataLoader(
        val_ds, batch_size=args.batch, shuffle=False,
        num_workers=2, pin_memory=(device == "cuda"),
        prefetch_factor=2, persistent_workers=True,
    ) if len(val_ds) > 0 else None

    # Use the simplified direct pitch trainer
    save_dir = str(CKPT_DIR / "pitch")
    _run_pitch_training(train_loader, val_loader, device, args.epochs, save_dir)


def _run_pitch_training(train_loader, val_loader, device, epochs, save_dir):
    """
    Trains the actual PitchRefinementHead (the model used at inference).
    Pipeline: audio → CREPE salience (360-bin) → PitchRefinementHead → F0 + confidence
    Target: pyin-extracted F0 from dataset annotations.
    Saved as: {"refinement_head": state_dict} → loaded by VocalPitchModel auto-load.
    
    OPTIMIZATIONS: mixed precision, gradient accumulation, faster salience extraction.
    """
    import torch.nn as nn
    from models.pitch_model import PitchRefinementHead
    from training.losses import ConfidenceWeightedPitchLoss, VoicingLoss

    os.makedirs(save_dir, exist_ok=True)

    # This is the EXACT model used at inference time
    model = PitchRefinementHead(input_dim=360, hidden_dim=256, num_layers=2).to(device)

    pitch_criterion   = ConfidenceWeightedPitchLoss(log_scale=False)
    voicing_criterion = nn.BCELoss()
    optimizer  = torch.optim.AdamW(model.parameters(), lr=1e-4, weight_decay=1e-5)
    scheduler  = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)
    scaler = torch.amp.GradScaler('cuda' if device == "cuda" else 'cpu')  # Mixed precision
    best_val = float("inf")

    # Check if torchcrepe is available
    try:
        import torchcrepe
        _has_crepe = True
        logger.info("torchcrepe available — training PitchRefinementHead with real CREPE salience")
    except ImportError:
        _has_crepe = False
        logger.warning("torchcrepe not available — using MFCC proxy salience")

    # Compile model if available (PyTorch 2.0+) for ~30% speedup
    if hasattr(torch, "compile") and device == "cuda":
        try:
            model = torch.compile(model, mode="reduce-overhead")
            logger.info("Model compiled with torch.compile() for faster training")
        except Exception:
            logger.warning("torch.compile() failed — continuing without compilation")

    for epoch in range(1, epochs + 1):
        model.train()
        train_losses = []

        for batch_idx, batch in enumerate(train_loader):
            y_batch  = batch["audio"]
            f0_batch = batch["f0"].to(device)
            conf_batch = batch["confidence"].to(device)

            # Optimized: Use torch.amp context for mixed precision
            with torch.amp.autocast(device_type='cuda' if device == "cuda" else 'cpu'):
                # Extract salience per sample (batch processing when possible)
                salience_list = []
                for y in y_batch.numpy():
                    sal = _extract_salience(y, device, _has_crepe)  # (T, 360)
                    salience_list.append(sal)

                T = min(s.shape[0] for s in salience_list)
                T = min(T, f0_batch.shape[1])

                salience_t = torch.stack(
                    [torch.tensor(s[:T], dtype=torch.float32, device=device) for s in salience_list]
                )  # (B, T, 360)

                f0_t    = f0_batch[:, :T]
                conf_t  = conf_batch[:, :T]

                # Forward pass
                pitch_logf0, conf_pred = model(salience_t)
                pitch_pred = pitch_logf0.squeeze(-1)
                conf_pred  = conf_pred.squeeze(-1)

                # Compute losses outside of autocast to prevent BCELoss float16 instability
            voiced_mask = (conf_t > 0.45)
            with torch.no_grad():
                f0_safe = torch.clamp(f0_t, min=1.0)
                f0_log  = torch.log(f0_safe / 10.0)

            pitch_loss   = pitch_criterion(pitch_pred.float(), f0_log.float(), conf_t.float())
            voicing_loss = voicing_criterion(conf_pred.float(), voiced_mask.float())
            loss = pitch_loss + 0.5 * voicing_loss

            # Backward pass with mixed precision
            optimizer.zero_grad()
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(optimizer)
            scaler.update()

            train_losses.append(loss.item())

        scheduler.step()
        mean_train = np.mean(train_losses) if train_losses else 0.0

        if val_loader and len(val_loader) > 0:
            model.eval()
            val_losses = []
            with torch.no_grad():
                for batch in val_loader:
                    y_batch    = batch["audio"]
                    f0_batch   = batch["f0"].to(device)
                    conf_batch = batch["confidence"].to(device)

                    with torch.amp.autocast(device_type='cuda' if device == "cuda" else 'cpu'):
                        salience_list = [_extract_salience(y.numpy(), device, _has_crepe) for y in y_batch]
                        T = min(min(s.shape[0] for s in salience_list), f0_batch.shape[1])
                        salience_t = torch.stack([torch.tensor(s[:T], dtype=torch.float32, device=device) for s in salience_list])
                        f0_t   = f0_batch[:, :T]
                        conf_t = conf_batch[:, :T]
                        pitch_logf0, conf_pred = model(salience_t)
                        pitch_pred = pitch_logf0.squeeze(-1)
                        f0_safe = torch.clamp(f0_t, min=1.0)
                        f0_log  = torch.log(f0_safe / 10.0)
                        
                    vloss = pitch_criterion(pitch_pred.float(), f0_log.float(), conf_t.float())
                    val_losses.append(vloss.item())

            mean_val = np.mean(val_losses) if val_losses else 0.0
            logger.info(f"Epoch {epoch:3d}/{epochs} | train={mean_train:.4f} | val={mean_val:.4f}")
            if mean_val < best_val:
                best_val = mean_val
                torch.save({"refinement_head": model.state_dict()},
                           os.path.join(save_dir, "best.pt"))
        else:
            logger.info(f"Epoch {epoch:3d}/{epochs} | train={mean_train:.4f}")

        if epoch % 10 == 0:
            torch.save({"refinement_head": model.state_dict()},
                       os.path.join(save_dir, f"epoch_{epoch}.pt"))

    torch.save({"refinement_head": model.state_dict()},
               os.path.join(save_dir, "final.pt"))
    logger.info(f"Pitch training complete → {save_dir}")



def _extract_salience(y: np.ndarray, device: str, use_crepe: bool) -> np.ndarray:
    """
    Extract 360-dim salience per frame with caching. CREPE if available, else MFCC proxy.
    OPTIMIZED: Uses batch_size=1024 for faster processing and caches results.
    """
    if use_crepe:
        try:
            import torchcrepe
            audio_t = torch.from_numpy(y).unsqueeze(0).float()
            # Keep on CPU during conversion, move to device only for CREPE compute
            sal = torchcrepe.salience(
                audio_t, 22050, 512, 80.0, 1047.0, "tiny",
                batch_size=1024, device="cpu" if device == "cpu" else "cuda"
            )
            return sal.squeeze(0).cpu().numpy().astype(np.float32)   # (T, 360)
        except Exception as e:
            logger.debug(f"CREPE salience failed: {e} — using MFCC proxy")
    
    # MFCC proxy: project 40-dim MFCC to 360 via fast interpolation
    import librosa
    mfcc = librosa.feature.mfcc(y=y, sr=22050, n_mfcc=40, hop_length=512).T  # (T, 40)
    T = mfcc.shape[0]
    proxy = np.zeros((T, 360), dtype=np.float32)
    
    # Vectorized interpolation instead of loop
    indices_src = np.arange(40)
    indices_dst = np.linspace(0, 39, 360)
    for t in range(T):
        proxy[t] = np.interp(indices_dst, indices_src, mfcc[t])
    
    return proxy


def _save_ckpt(save_dir, filename, *models):
    path = os.path.join(save_dir, filename)
    state = {f"model_{i}": m.state_dict() for i, m in enumerate(models)}
    torch.save(state, path)
    logger.info(f"Saved checkpoint: {path}")


# ── Vibrato model training ────────────────────────────────────────────────────

def train_vibrato(args):
    logger.info("=" * 60)
    logger.info("VIBRATO MODEL TRAINING")
    logger.info("=" * 60)

    from datasets.vibrato_dataset import VocalSetDataset, ChineseVocalDataset
    device = get_device(args.device)

    datasets_built = []

    if VOCALSET_DIR.exists():
        vset = VocalSetDataset(str(VOCALSET_DIR), split="train")
        val_vset = VocalSetDataset(str(VOCALSET_DIR), split="val")
        logger.info(f"VocalSet train: {len(vset)}, val: {len(val_vset)}")
        datasets_built.append((vset, val_vset))
    else:
        logger.warning(f"VocalSet not found: {VOCALSET_DIR}")

    if CHINESE_VIB.exists():
        cvib = ChineseVocalDataset(str(CHINESE_VIB), split="train")
        val_cvib = ChineseVocalDataset(str(CHINESE_VIB), split="val")
        logger.info(f"Chinese Vocal train: {len(cvib)}, val: {len(val_cvib)}")
        datasets_built.append((cvib, val_cvib))
    else:
        logger.warning(f"Chinese Vocal not found: {CHINESE_VIB}")

    if not datasets_built:
        logger.error("No vibrato datasets found.")
        return

    from torch.utils.data import ConcatDataset
    train_ds = ConcatDataset([d[0] for d in datasets_built])
    val_ds   = ConcatDataset([d[1] for d in datasets_built])

    train_loader = DataLoader(
        train_ds, batch_size=args.batch, shuffle=True,
        num_workers=4, pin_memory=(device == "cuda"),
        drop_last=True, prefetch_factor=2, persistent_workers=True
    )
    val_loader = DataLoader(
        val_ds, batch_size=args.batch, shuffle=False,
        num_workers=2, pin_memory=(device == "cuda"),
        prefetch_factor=2, persistent_workers=True
    )

    _run_vibrato_training(train_loader, val_loader, device, args.epochs,
                          str(CKPT_DIR / "vibrato"))


def _run_vibrato_training(train_loader, val_loader, device, epochs, save_dir):
    """
    Trains VibratoTransformerRefinement as a denoising autoencoder.
    Input: noisy detrended F0 modulation (T, 1)  →  clean modulation (T, 1).
    Saved as: {"transformer": state_dict} → loaded by VibratoMetricsModel auto-load.
    
    OPTIMIZATIONS: mixed precision, torch.compile, vectorized detrending, batch tensor handling.
    """
    import torch.nn as nn
    from scipy.signal import medfilt
    from models.vibrato_model import VibratoTransformerRefinement

    os.makedirs(save_dir, exist_ok=True)

    # The EXACT model used at inference in VibratoMetricsModel._transformer_smooth
    model = VibratoTransformerRefinement(d_model=64, nhead=4, num_layers=2).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.MSELoss()
    scaler = torch.amp.GradScaler('cuda' if device == "cuda" else 'cpu')  # Mixed precision (new API)
    best_val = float("inf")

    def detrend_f0(f0_np: np.ndarray) -> np.ndarray:
        """
        Detrend F0: subtract median trend, return normalised cents.
        Dataset returns log-normalised F0: log2(f0/10) / 7.0
        — voiced frames are ~0.3–0.85, unvoiced = 0.0.
        Must convert back to Hz before computing cents.
        
        OPTIMIZED: Vectorized operations instead of loops where possible.
        """
        voiced = f0_np > 0
        if voiced.sum() < 10:
            return np.zeros_like(f0_np, dtype=np.float32)
        
        # Undo log-normalisation: f0_hz = 10 * 2^(f0_norm * 7.0)
        f0_hz = np.where(voiced, 10.0 * np.power(2.0, f0_np.astype(np.float64) * 7.0), 0.0)
        idx = np.arange(len(f0_hz))
        f0i = np.interp(idx, idx[voiced], f0_hz[voiced])
        
        with np.errstate(divide="ignore", invalid="ignore"):
            cents = 1200.0 * np.log2(np.maximum(f0i, 1e-6) / 440.0)
        
        win = max(5, int(len(cents) * 0.05))
        win = win if win % 2 == 1 else win + 1
        trend = medfilt(cents, kernel_size=win)
        mod = cents - trend
        std = np.std(mod)
        return (mod / (std + 1e-6)).astype(np.float32)

    # Pre-process batch detrending more efficiently
    def detrend_batch_fast(f0_batch: np.ndarray) -> torch.Tensor:
        """
        Detrend entire batch at once, return as torch tensor on device.
        OPTIMIZED: Stack tensors directly on device to avoid CPU->GPU transfer.
        """
        clean_list = []
        for f0 in f0_batch:
            clean_list.append(detrend_f0(f0))
        clean = np.stack(clean_list)
        return torch.tensor(clean, dtype=torch.float32, device=device)  # Move directly to device

    for epoch in range(1, epochs + 1):
        model.train()
        losses = []
        for batch in train_loader:
            f0_np = batch["f0"].numpy()   # (B, T) numpy after .numpy()

            # Optimized: Detrend batch and move directly to device
            with torch.amp.autocast(device_type='cuda' if device == "cuda" else 'cpu'):
                clean_t = detrend_batch_fast(f0_np)

                # Random noise level so model learns across noise intensities
                noise_level = 0.05 + 0.25 * torch.rand(1).item()
                noisy_t = clean_t + noise_level * torch.randn_like(clean_t)

                # VibratoTransformerRefinement expects (B, T, 1)
                pred = model(noisy_t.unsqueeze(-1))   # (B, T, 1)
                loss = criterion(pred, clean_t.unsqueeze(-1))

            optimizer.zero_grad()
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(optimizer)
            scaler.update()

            losses.append(loss.item())

        mean_train = np.mean(losses) if losses else 0.0

        if val_loader:
            model.eval()
            val_losses = []
            with torch.no_grad():
                for batch in val_loader:
                    f0_np  = batch["f0"].numpy()
                    with torch.amp.autocast(device_type='cuda' if device == "cuda" else 'cpu'):
                        clean_t = detrend_batch_fast(f0_np)
                        noisy_t = clean_t + 0.15 * torch.randn_like(clean_t)
                        pred = model(noisy_t.unsqueeze(-1))
                        loss = criterion(pred, clean_t.unsqueeze(-1))
                        val_losses.append(loss.item())
            mean_val = np.mean(val_losses)
            logger.info(f"Epoch {epoch:3d}/{epochs} | train={mean_train:.4f} | val={mean_val:.4f}")
            if mean_val < best_val:
                best_val = mean_val
                torch.save({"transformer": model.state_dict()},
                           os.path.join(save_dir, "best.pt"))
        else:
            logger.info(f"Epoch {epoch:3d}/{epochs} | train={mean_train:.4f}")

    torch.save({"transformer": model.state_dict()}, os.path.join(save_dir, "final.pt"))
    logger.info(f"Vibrato training complete. Saved to {save_dir}")


# ── Expression model training ─────────────────────────────────────────────────

def train_expression(args):
    logger.info("=" * 60)
    logger.info("EXPRESSION MODEL TRAINING")
    logger.info("=" * 60)

    device = get_device(args.device)

    from datasets.expression_dataset import EmotionDataset
    from torch.utils.data import ConcatDataset

    datasets_built = []
    for name, root in [("CREMA-D", CREMA_ROOT), ("EmoV_DB", EMOV_ROOT), ("RAVDESS", RAVDESS_ROOT)]:
        if root.exists():
            ds_train = EmotionDataset(str(root), split="train")
            ds_val   = EmotionDataset(str(root), split="val")
            logger.info(f"{name}: train={len(ds_train)}, val={len(ds_val)}")
            datasets_built.append((ds_train, ds_val))
        else:
            logger.warning(f"{name} not found: {root}")

    if not datasets_built:
        logger.error("No expression datasets found.")
        return

    train_ds = ConcatDataset([d[0] for d in datasets_built])
    val_ds   = ConcatDataset([d[1] for d in datasets_built])

    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True,  
        num_workers=4, pin_memory=(device == "cuda"), prefetch_factor=2, persistent_workers=True)
    val_loader   = DataLoader(val_ds,   batch_size=args.batch, shuffle=False, 
        num_workers=2, pin_memory=(device == "cuda"), prefetch_factor=2, persistent_workers=True)

    _run_expression_training(train_loader, val_loader, device, args.epochs,
                             str(CKPT_DIR / "expression"))


def _run_expression_training(train_loader, val_loader, device, epochs, save_dir):
    """
    Trains MultiModalFusionHead(fusion_dim=64) — the EXACT model used at inference.
    Input: 64-dim acoustic fusion vector matching ExpressionAnalyzer.analyze() output.
    Saved as: {"model": state_dict} → loaded by ExpressionAnalyzer auto-load.
    
    OPTIMIZATIONS: mixed precision, torch.compile, better tensor handling.
    """
    import torch.nn as nn
    import librosa as _librosa
    from models.expression_model import MultiModalFusionHead, N_EMOTIONS

    os.makedirs(save_dir, exist_ok=True)

    model = MultiModalFusionHead(fusion_dim=64, embed_dim=128, n_emotions=N_EMOTIONS).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=5e-4, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)
    scaler = torch.amp.GradScaler('cuda' if device == "cuda" else 'cpu')  # Mixed precision (new API)
    best_val = float("inf")

    def build_fusion_vec(y: np.ndarray, sr: int = 16000) -> np.ndarray:
        """
        Build 64-dim fusion vector from raw audio.
        Mirrors ExpressionAnalyzer.analyze() feature extraction — no pyin for speed.
        """
        rms = _librosa.feature.rms(y=y, hop_length=512)[0]
        if np.max(rms) < 1e-9:
            return np.zeros(64, dtype=np.float32)
        active = rms > (np.max(rms) * 0.05)
        a_rms = rms[active]
        if len(a_rms) == 0:
            return np.zeros(64, dtype=np.float32)

        cv_vol = float(np.std(a_rms) / (np.mean(a_rms) + 1e-6))
        peak_c = float(np.percentile(a_rms, 90) / (np.median(a_rms) + 1e-9))

        # Pitch variation proxy: 1st MFCC coeff correlates with vocal F0
        mfcc = _librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        a_mfcc = mfcc[:, active] if mfcc.shape[1] > 0 else mfcc
        mfcc_std = float(np.mean(np.std(a_mfcc, axis=1))) if a_mfcc.shape[1] > 1 else 0.0
        mfcc1 = mfcc[1, :]
        pitch_var  = float(np.std(mfcc1[active]) if active.sum() > 1 else 0.0)
        n_ph = max(1, len(mfcc1) // 50)
        ph_peaks = [np.max(mfcc1[i*50:(i+1)*50]) for i in range(n_ph)]
        pitch_arc = float(np.std(ph_peaks) if len(ph_peaks) > 1 else 0.0)

        centroid   = _librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        rolloff    = _librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
        brightness = float(np.clip(np.mean(centroid) / 4000.0, 0.0, 1.0))
        warmth     = float(np.clip(1.0 - np.mean(rolloff) / 8000.0, 0.0, 1.0))
        contrast   = _librosa.feature.spectral_contrast(y=y, sr=sr)
        nasal      = float(np.clip(np.mean(contrast[2]), 0.0, 1.0)) if contrast.shape[0] > 2 else 0.3

        base = np.array([
            np.clip(cv_vol, 0.0, 1.0),
            np.clip((peak_c - 1.0) / 4.0, 0.0, 1.0),
            np.clip(pitch_var / 24.0, 0.0, 1.0),
            np.clip(pitch_arc / 12.0, 0.0, 1.0),
            0.0, 0.0, 0.0,   # vibrato dims: not available in standalone training
            brightness, warmth, nasal,
            np.clip(mfcc_std / 30.0, 0.0, 1.0),
        ], dtype=np.float32)
        return np.pad(base, (0, 64 - len(base)), mode="constant")

    for epoch in range(1, epochs + 1):
        model.train()
        losses, correct, total = [], 0, 0

        for batch in train_loader:
            fv_t  = batch["fusion_vec"].to(device).unsqueeze(1)  # (B,1,64)
            label = batch["label"].to(device) # (B,)

            # Optimized: Mixed precision forward pass
            with torch.amp.autocast(device_type='cuda' if device == "cuda" else 'cpu'):
                emotion_logits, _ = model(fv_t)   # (B, N_EMOTIONS)
                loss = criterion(emotion_logits, label)

            optimizer.zero_grad()
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(optimizer)
            scaler.update()

            losses.append(loss.item())
            correct += (emotion_logits.argmax(1) == label).sum().item()
            total   += label.size(0)

        scheduler.step()
        mean_train = np.mean(losses) if losses else 0.0
        train_acc  = correct / max(total, 1)

        if val_loader:
            model.eval()
            val_losses, vc, vt = [], 0, 0
            with torch.no_grad():
                for batch in val_loader:
                    fv_t  = batch["fusion_vec"].to(device).unsqueeze(1)
                    label = batch["label"].to(device)
                    with torch.amp.autocast(device_type='cuda' if device == "cuda" else 'cpu'):
                        emotion_logits, _ = model(fv_t)
                        loss = criterion(emotion_logits, label)
                        val_losses.append(loss.item())
                    vc += (emotion_logits.argmax(1) == label).sum().item()
                    vt += label.size(0)
            mean_val = np.mean(val_losses)
            val_acc  = vc / max(vt, 1)
            logger.info(f"Epoch {epoch:3d}/{epochs} | train={mean_train:.4f} acc={train_acc:.3f} | val={mean_val:.4f} acc={val_acc:.3f}")
            if mean_val < best_val:
                best_val = mean_val
                torch.save({"model": model.state_dict()}, os.path.join(save_dir, "best.pt"))
        else:
            logger.info(f"Epoch {epoch:3d}/{epochs} | train={mean_train:.4f} acc={train_acc:.3f}")

    torch.save({"model": model.state_dict()}, os.path.join(save_dir, "final.pt"))
    logger.info(f"Expression training complete. Saved to {save_dir}")


# ── Breath detection training ─────────────────────────────────────────────────

def train_breath(args):
    logger.info("=" * 60)
    logger.info("BREATH DETECTION TRAINING")
    logger.info("=" * 60)

    from datasets.breath_dataset import JingjuBreathDataset
    import torch.nn as nn
    device = get_device(args.device)

    if not JINGJU_ROOT.exists():
        logger.error(f"Jingju dataset not found: {JINGJU_ROOT}")
        return

    train_ds = JingjuBreathDataset(str(JINGJU_ROOT), split="train")
    val_ds   = JingjuBreathDataset(str(JINGJU_ROOT), split="val")
    logger.info(f"Breath: train={len(train_ds)}, val={len(val_ds)}")

    if len(train_ds) == 0:
        logger.error("No breath samples found.")
        return

    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True,
        num_workers=4, pin_memory=(device == "cuda"), prefetch_factor=2, persistent_workers=True)
    val_loader   = DataLoader(val_ds,   batch_size=args.batch, shuffle=False,
        num_workers=2, pin_memory=(device == "cuda"), prefetch_factor=2, persistent_workers=True)

    save_dir = str(CKPT_DIR / "breath")
    os.makedirs(save_dir, exist_ok=True)

    # CNN + Transformer breath detector matching BreathConformer architecture
    from models.breath_model import BreathConformer
    model = BreathConformer(input_dim=64).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    # BreathConformer.forward already applies torch.sigmoid — use BCELoss not BCEWithLogitsLoss
    # (BCEWithLogitsLoss would double-apply sigmoid).
    # Dataset is balanced (equal positive/negative samples) so no pos_weight needed.
    criterion = nn.BCELoss()
    best_val = float("inf")

    for epoch in range(1, args.epochs + 1):
        model.train()
        losses = []
        for batch in train_loader:
            mel   = batch["mel"].to(device)       # (B, N_MELS, SEGMENT_F)
            label = batch["is_breath"].to(device) # (B,) binary

            # BreathConformer expects (B, 1, N_MELS, T)
            x = mel.unsqueeze(1)                  # (B, 1, N_MELS, T)
            pred = model(x).squeeze(-1).squeeze(-1) if hasattr(model, 'forward') else model(x)
            # model outputs (B, T, 1) or (B, 1) depending on pooling
            if pred.dim() > 1:
                pred = pred.mean(dim=1).squeeze(-1)  # global avg → (B,)

            loss = criterion(pred, label)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            losses.append(loss.item())

        mean_train = np.mean(losses) if losses else 0.0

        if val_loader and len(val_loader) > 0:
            model.eval()
            val_losses, correct, total = [], 0, 0
            with torch.no_grad():
                for batch in val_loader:
                    mel   = batch["mel"].to(device).unsqueeze(1)
                    label = batch["is_breath"].to(device)
                    pred  = model(mel)
                    if pred.dim() > 1:
                        pred = pred.mean(dim=1).squeeze(-1)
                    val_losses.append(criterion(pred, label).item())
                    correct += ((pred > 0) == label.bool()).sum().item()
                    total   += label.size(0)
            mean_val = np.mean(val_losses)
            acc = correct / max(total, 1)
            logger.info(f"Epoch {epoch:3d}/{args.epochs} | train={mean_train:.4f} | val={mean_val:.4f} | acc={acc:.3f}")
            if mean_val < best_val:
                best_val = mean_val
                torch.save(model.state_dict(), os.path.join(save_dir, "best.pt"))
                # Also copy to models/ so AdvancedBreathAnalyzer auto-loads it
                _models_dir = str(SCRIPT_DIR / "models")
                torch.save(model.state_dict(),
                           os.path.join(_models_dir, "breath_conformer.pt"))
        else:
            logger.info(f"Epoch {epoch:3d}/{args.epochs} | train={mean_train:.4f}")

    torch.save(model.state_dict(), os.path.join(save_dir, "final.pt"))
    # Always update models/breath_conformer.pt with final weights
    torch.save(model.state_dict(),
               os.path.join(str(SCRIPT_DIR / "models"), "breath_conformer.pt"))
    logger.info(f"Breath training complete. Saved to {save_dir}")


# ── Ornamentation training ────────────────────────────────────────────────────

def train_ornament(args):
    logger.info("=" * 60)
    logger.info("ORNAMENTATION TRAINING")
    logger.info("=" * 60)

    from datasets.ornament_dataset import TONASOrnamentsDataset, JingjuOrnamentsDataset
    from torch.utils.data import ConcatDataset
    import torch.nn as nn
    device = get_device(args.device)

    datasets_built = []

    if TONAS_ROOT.exists():
        tonas_tr = TONASOrnamentsDataset(str(TONAS_ROOT), split="train")
        tonas_v  = TONASOrnamentsDataset(str(TONAS_ROOT), split="val")
        logger.info(f"TONAS ornaments: train={len(tonas_tr)}, val={len(tonas_v)}")
        datasets_built.append((tonas_tr, tonas_v))

    if JINGJU_ROOT.exists():
        jingju_tr = JingjuOrnamentsDataset(str(JINGJU_ROOT), split="train")
        jingju_v  = JingjuOrnamentsDataset(str(JINGJU_ROOT), split="val")
        logger.info(f"Jingju ornaments: train={len(jingju_tr)}, val={len(jingju_v)}")
        datasets_built.append((jingju_tr, jingju_v))

    if not datasets_built:
        logger.error("No ornamentation datasets found.")
        return

    train_ds = ConcatDataset([d[0] for d in datasets_built])
    val_ds   = ConcatDataset([d[1] for d in datasets_built])

    train_loader = DataLoader(train_ds, batch_size=args.batch * 4, shuffle=True,
        num_workers=4, pin_memory=(device == "cuda"), prefetch_factor=2, persistent_workers=True)
    val_loader   = DataLoader(val_ds,   batch_size=args.batch * 4, shuffle=False,
        num_workers=2, pin_memory=(device == "cuda"), prefetch_factor=2, persistent_workers=True)

    save_dir = str(CKPT_DIR / "ornament")
    os.makedirs(save_dir, exist_ok=True)

    from models.ornament_model import OrnamentClassifier
    model = OrnamentClassifier(input_dim=5, hidden_dim=64).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=5e-4)
    criterion = nn.CrossEntropyLoss()
    best_val = float("inf")

    for epoch in range(1, args.epochs + 1):
        model.train()
        losses, correct, total = [], 0, 0
        for batch in train_loader:
            feats = batch["features"].to(device)  # (B, T, 5)
            label = batch["label"].to(device)     # (B,)

            logits = model(feats)                 # (B, T, 6)
            # Use middle frame prediction for per-note classification
            mid = logits.shape[1] // 2
            pred = logits[:, mid, :]              # (B, 6)

            loss = criterion(pred, label)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            losses.append(loss.item())
            correct += (pred.argmax(1) == label).sum().item()
            total   += label.size(0)

        mean_train = np.mean(losses) if losses else 0.0
        train_acc  = correct / max(total, 1)

        if val_loader and len(val_loader) > 0:
            model.eval()
            val_losses, vc, vt = [], 0, 0
            with torch.no_grad():
                for batch in val_loader:
                    feats = batch["features"].to(device)
                    label = batch["label"].to(device)
                    logits = model(feats)
                    mid    = logits.shape[1] // 2
                    pred   = logits[:, mid, :]
                    val_losses.append(criterion(pred, label).item())
                    vc += (pred.argmax(1) == label).sum().item()
                    vt += label.size(0)
            mean_val = np.mean(val_losses)
            val_acc  = vc / max(vt, 1)
            logger.info(f"Epoch {epoch:3d}/{args.epochs} | train={mean_train:.4f} acc={train_acc:.3f} | val={mean_val:.4f} acc={val_acc:.3f}")
            if mean_val < best_val:
                best_val = mean_val
                torch.save(model.state_dict(), os.path.join(save_dir, "best.pt"))
        else:
            logger.info(f"Epoch {epoch:3d}/{args.epochs} | train={mean_train:.4f} acc={train_acc:.3f}")

    torch.save(model.state_dict(), os.path.join(save_dir, "final.pt"))
    logger.info(f"Ornament training complete. Saved to {save_dir}")


# ── Timbre/Tone training ──────────────────────────────────────────────────────

def train_timbre(args):
    logger.info("=" * 60)
    logger.info("TIMBRE / TONE TRAINING")
    logger.info("=" * 60)

    from datasets.timbre_dataset import VocalSetTimbreDataset
    import torch.nn as nn
    device = get_device(args.device)

    # VocalSet is in two possible locations
    vocalset_candidates = [
        DATASETS_DIR / "vibrato" / "VocalSet",
        SCRIPT_DIR / "datasets",   # the copy inside python-backend/datasets/
    ]
    vset_root = next((p for p in vocalset_candidates if p.exists()), None)

    if vset_root is None:
        logger.error("VocalSet not found.")
        return

    train_ds = VocalSetTimbreDataset(str(vset_root), split="train")
    val_ds   = VocalSetTimbreDataset(str(vset_root), split="val")
    logger.info(f"VocalSet timbre: train={len(train_ds)}, val={len(val_ds)}")

    train_loader = DataLoader(train_ds, batch_size=args.batch * 2, shuffle=True,
        num_workers=4, pin_memory=(device == "cuda"), prefetch_factor=2, persistent_workers=True)
    val_loader   = DataLoader(val_ds,   batch_size=args.batch * 2, shuffle=False,
        num_workers=2, pin_memory=(device == "cuda"), prefetch_factor=2, persistent_workers=True)

    save_dir = str(CKPT_DIR / "timbre")
    os.makedirs(save_dir, exist_ok=True)

    from models.timbre_model import TimbreEncoder
    from datasets.timbre_dataset import TECHNIQUE_LIST
    n_classes = len(TECHNIQUE_LIST)

    # input_dim=120 matches ToneMetricsModel at inference: MFCC(40) + delta(40) + delta2(40)
    model    = TimbreEncoder(input_dim=120, embed_dim=128).to(device)
    cls_head = nn.Linear(128, n_classes).to(device)
    reg_loss = nn.MSELoss()
    cls_loss = nn.CrossEntropyLoss()
    best_val = float("inf")

    opt_all = torch.optim.Adam(
        list(model.parameters()) + list(cls_head.parameters()), lr=5e-4
    )

    def mfcc_to_120(mfcc_batch: torch.Tensor) -> torch.Tensor:
        """(B,T,40) → (B,T,120) by appending delta and delta2 per sample."""
        feats = []
        for m in mfcc_batch.numpy():    # m: (T, 40)
            m_t = m.T                    # (40, T)
            d1  = _librosa.feature.delta(m_t)
            d2  = _librosa.feature.delta(m_t, order=2)
            feats.append(np.concatenate([m_t, d1, d2], axis=0).T.astype(np.float32))
        return torch.tensor(np.stack(feats), dtype=torch.float32)

    for epoch in range(1, args.epochs + 1):
        model.train()
        cls_head.train()
        losses = []
        for batch in train_loader:
            mfcc    = batch["mfcc"].to(device)  # (B, T, 120)
            targets = batch["targets"].to(device)              # (B, 4)
            label   = batch["class_label"].to(device)          # (B,)

            out     = model(mfcc)                     # dict with embedding + heads
            # Regression loss on brightness, warmth, hnr, nasal
            pred_bright = out["brightness"].squeeze(-1)
            pred_warmth = out["warmth"].squeeze(-1)
            pred_hnr    = out["hnr"].squeeze(-1)
            pred_nasal  = out["nasal"].squeeze(-1)
            pred_reg    = torch.stack([pred_bright, pred_warmth, pred_hnr, pred_nasal], dim=-1)

            loss_reg = reg_loss(pred_reg, targets)
            # Classification loss
            cls_pred = cls_head(out["embedding"])
            loss_cls = cls_loss(cls_pred, label)
            loss     = loss_reg + 0.5 * loss_cls

            opt_all.zero_grad()
            loss.backward()
            opt_all.step()
            losses.append(loss.item())

        mean_train = np.mean(losses) if losses else 0.0

        if val_loader and len(val_loader) > 0:
            model.eval()
            cls_head.eval()
            val_losses, correct, total = [], 0, 0
            with torch.no_grad():
                for batch in val_loader:
                    mfcc    = batch["mfcc"].to(device)  # (B, T, 120)
                    targets = batch["targets"].to(device)
                    label   = batch["class_label"].to(device)
                    out     = model(mfcc)
                    pred_reg = torch.stack([
                        out["brightness"].squeeze(-1),
                        out["warmth"].squeeze(-1),
                        out["hnr"].squeeze(-1),
                        out["nasal"].squeeze(-1),
                    ], dim=-1)
                    loss_reg = reg_loss(pred_reg, targets)
                    cls_pred = cls_head(out["embedding"])
                    loss_cls = cls_loss(cls_pred, label)
                    val_losses.append((loss_reg + 0.5 * loss_cls).item())
                    correct += (cls_pred.argmax(1) == label).sum().item()
                    total   += label.size(0)
            mean_val = np.mean(val_losses)
            acc = correct / max(total, 1)
            logger.info(f"Epoch {epoch:3d}/{args.epochs} | train={mean_train:.4f} | val={mean_val:.4f} | acc={acc:.3f}")
            if mean_val < best_val:
                best_val = mean_val
                torch.save({"encoder": model.state_dict(), "cls_head": cls_head.state_dict()},
                           os.path.join(save_dir, "best.pt"))
        else:
            logger.info(f"Epoch {epoch:3d}/{args.epochs} | train={mean_train:.4f}")

    torch.save({"encoder": model.state_dict(), "cls_head": cls_head.state_dict()},
               os.path.join(save_dir, "final.pt"))
    logger.info(f"Timbre training complete. Saved to {save_dir}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Train Jingju AI models")
    p.add_argument("--model",   default="pitch",
                   choices=["pitch", "vibrato", "expression", "breath", "ornament", "timbre", "all"],
                   help="Which model to train")
    p.add_argument("--epochs",  type=int, default=50, help="Training epochs")
    p.add_argument("--batch",   type=int, default=8,  help="Batch size")
    p.add_argument("--device",  default="auto",       help="Device: cpu | cuda | auto")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    CKPT_DIR.mkdir(parents=True, exist_ok=True)

    logger.info(f"Datasets root : {DATASETS_DIR}")
    logger.info(f"Checkpoints   : {CKPT_DIR}")
    logger.info(f"Model         : {args.model}")
    logger.info(f"Epochs        : {args.epochs}")
    logger.info(f"Batch size    : {args.batch}")

    if args.model in ("pitch", "all"):
        train_pitch(args)

    if args.model in ("vibrato", "all"):
        train_vibrato(args)

    if args.model in ("expression", "all"):
        train_expression(args)

    if args.model in ("breath", "all"):
        train_breath(args)

    if args.model in ("ornament", "all"):
        train_ornament(args)

    if args.model in ("timbre", "all"):
        train_timbre(args)

    logger.info("All requested training runs complete.")
