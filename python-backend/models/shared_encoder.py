"""
Phase 3: Shared Acoustic Encoder — CNN + BiLSTM + Harmonic Attention

Architecture:
  Input (B, C_in, T)  — unified feature tensor (207 channels)
     │
  ┌──▼────────────────┐
  │  CNN Frontend     │  local time-frequency pattern extraction
  │  4× Conv1d blocks │
  └──────────┬────────┘
             │  (B, CNN_DIM, T)
  ┌──────────▼────────┐
  │  BiLSTM           │  temporal context modelling (pitch contours, vibrato cycles)
  │  3 layers         │
  └──────────┬────────┘
             │  (B, T, LSTM_DIM)
  ┌──────────▼────────┐
  │  Harmonic         │  attention over harmonic frequency bins
  │  Attention        │  (H1, H2, … Hn self-attention heads)
  └──────────┬────────┘
             │  (B, T, ENC_DIM)
  ┌──────────▼────────┐
  │  Role FiLM        │  role-conditioned Feature-wise Linear Modulation
  │  (scale + shift)  │  adapts representation for Dan/Sheng/Jing/Chou
  └──────────┬────────┘
             │  (B, T, ENC_DIM)  ← shared representation for all downstream heads
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from .role_embeddings import RoleEmbedding, EMBED_DIM

FEATURE_DIM = 207   # matches features/extractor.py FEATURE_DIM
CNN_DIM = 256
LSTM_DIM = 256      # per-direction; hidden = 512 after bidirectional
ENC_DIM = 512       # final encoder output dimension


class CNNFrontend(nn.Module):
    """
    4-block CNN frontend — extracts local spectro-temporal patterns.
    Uses depthwise-separable convolutions for efficiency.
    """

    def __init__(self, in_channels: int = FEATURE_DIM, out_channels: int = CNN_DIM):
        super().__init__()
        self.blocks = nn.Sequential(
            self._conv_block(in_channels, 128, kernel=7),
            self._conv_block(128, 192, kernel=5),
            self._conv_block(192, CNN_DIM, kernel=3),
            self._conv_block(CNN_DIM, CNN_DIM, kernel=3),
        )
        self.proj = nn.Linear(CNN_DIM, CNN_DIM)

    @staticmethod
    def _conv_block(in_c, out_c, kernel):
        padding = kernel // 2
        return nn.Sequential(
            nn.Conv1d(in_c, in_c, kernel_size=kernel, padding=padding, groups=in_c),  # depthwise
            nn.Conv1d(in_c, out_c, kernel_size=1),                                     # pointwise
            nn.BatchNorm1d(out_c),
            nn.GELU(),
            nn.Dropout(0.1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, C_in, T)
        return self.blocks(x)   # (B, CNN_DIM, T)


class BiLSTMEncoder(nn.Module):
    """
    3-layer Bidirectional LSTM for long-range temporal modelling.
    Captures vibrato cycles, glissando trajectories, and phrase-level context.
    """

    def __init__(self, input_size: int = CNN_DIM, hidden_size: int = LSTM_DIM, num_layers: int = 3):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=0.2,
        )
        self.norm = nn.LayerNorm(hidden_size * 2)
        self.proj = nn.Linear(hidden_size * 2, ENC_DIM)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, T, CNN_DIM)
        out, _ = self.lstm(x)       # (B, T, LSTM_DIM*2)
        out = self.norm(out)
        return self.proj(out)        # (B, T, ENC_DIM)


class HarmonicAttention(nn.Module):
    """
    Multi-head self-attention with harmonic-position bias.

    Standard self-attention has no inductive bias for harmonics.
    We add a learnable harmonic position encoding — the model learns to
    attend to harmonically related time steps (e.g. vibrato peak-to-peak).
    This improves stability on sustained notes with complex overtone structure
    (critical for 大嗓 Jing roles with strong harmonic content).
    """

    def __init__(self, dim: int = ENC_DIM, num_heads: int = 8, max_harmonics: int = 8):
        super().__init__()
        self.attn = nn.MultiheadAttention(
            embed_dim=dim,
            num_heads=num_heads,
            dropout=0.1,
            batch_first=True,
        )
        self.harmonic_pos = nn.Embedding(max_harmonics, dim)
        self.norm = nn.LayerNorm(dim)
        self.ff = nn.Sequential(
            nn.Linear(dim, dim * 4),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(dim * 4, dim),
            nn.Dropout(0.1),
        )
        self.norm2 = nn.LayerNorm(dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, T, ENC_DIM)
        T = x.size(1)

        # Harmonic position bias: modulate by position % 8 (harmonic cycles)
        harm_idx = torch.arange(T, device=x.device) % self.harmonic_pos.num_embeddings
        h_pos = self.harmonic_pos(harm_idx).unsqueeze(0)   # (1, T, dim)
        x_pos = x + h_pos

        # Self-attention
        attn_out, _ = self.attn(x_pos, x_pos, x_pos)
        x = self.norm(x + attn_out)

        # Feed-forward
        x = self.norm2(x + self.ff(x))
        return x   # (B, T, ENC_DIM)


class RoleFiLM(nn.Module):
    """
    Feature-wise Linear Modulation conditioned on role embedding.
    Learns to scale and shift the shared representation per 行当 type.
    This allows one encoder to serve all four role categories.
    """

    def __init__(self, enc_dim: int = ENC_DIM, role_dim: int = EMBED_DIM):
        super().__init__()
        self.to_scale = nn.Linear(role_dim, enc_dim)
        self.to_shift = nn.Linear(role_dim, enc_dim)

    def forward(self, x: torch.Tensor, role_emb: torch.Tensor) -> torch.Tensor:
        # x: (B, T, ENC_DIM),  role_emb: (B, EMBED_DIM)
        scale = self.to_scale(role_emb).unsqueeze(1)   # (B, 1, ENC_DIM)
        shift = self.to_shift(role_emb).unsqueeze(1)   # (B, 1, ENC_DIM)
        return x * (1.0 + scale) + shift


class SharedAcousticEncoder(nn.Module):
    """
    Full shared encoder: CNN → BiLSTM → HarmonicAttention → RoleFiLM

    All downstream models (pitch, vibrato, timbre, ornament, expression)
    take this encoder's output as input — no duplicate feature learning.
    """

    def __init__(
        self,
        feature_dim: int = FEATURE_DIM,
        enc_dim: int = ENC_DIM,
    ):
        super().__init__()
        self.cnn = CNNFrontend(in_channels=feature_dim, out_channels=CNN_DIM)
        self.bilstm = BiLSTMEncoder(input_size=CNN_DIM, hidden_size=LSTM_DIM)
        self.harmonic_attn = HarmonicAttention(dim=enc_dim)
        self.role_film = RoleFiLM(enc_dim=enc_dim)
        self.role_emb = RoleEmbedding()

        self.enc_dim = enc_dim

    def forward(
        self,
        features: torch.Tensor,
        role: str = "default",
    ) -> torch.Tensor:
        """
        Args:
            features: (B, FEATURE_DIM, T) — output of JingjuFeatureExtractor
            role:     role name string for FiLM conditioning

        Returns:
            encoded: (B, T, ENC_DIM) — shared representation
        """
        B = features.size(0)
        device = features.device

        # CNN: (B, FEATURE_DIM, T) → (B, CNN_DIM, T)
        x = self.cnn(features)

        # BiLSTM needs (B, T, C)
        x = x.permute(0, 2, 1)                    # (B, T, CNN_DIM)
        x = self.bilstm(x)                          # (B, T, ENC_DIM)

        # Harmonic attention
        x = self.harmonic_attn(x)                   # (B, T, ENC_DIM)

        # Role FiLM conditioning
        role_vec = self.role_emb(role, device=str(device))          # (1, EMBED_DIM)
        role_vec = role_vec.expand(B, -1)                            # (B, EMBED_DIM)
        x = self.role_film(x, role_vec)                              # (B, T, ENC_DIM)

        return x

    def encode_segments(
        self,
        feature_list: list,
        role: str = "default",
        device: str = "cpu",
    ) -> list:
        """Encode a list of FeatureTensor segments (no batching required)."""
        self.eval()
        results = []
        with torch.no_grad():
            for ft in feature_list:
                t = ft.to_torch(device=device)     # (1, FEATURE_DIM, T)
                enc = self.forward(t, role=role)   # (1, T, ENC_DIM)
                results.append(enc)
        return results
