"""
Confidence-Weighted Losses for Jingju Pitch Detection Training

Key principle: low-confidence frames (noisy, unvoiced, ambiguous) should
contribute less to the gradient. This prevents the model from over-fitting
to inherently uncertain labels from automated annotation tools.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional


class ConfidenceWeightedPitchLoss(nn.Module):
    """
    L1 pitch regression loss weighted by frame-level confidence scores.

    Loss = mean( confidence_i * |pred_pitch_i - target_pitch_i| )
           for voiced frames only

    Low-confidence frames contribute near-zero gradient.
    Unvoiced frames (confidence < threshold) are excluded entirely.
    """

    def __init__(
        self,
        voiced_threshold: float = 0.45,
        log_scale: bool = True,
        eps: float = 1e-3,
    ):
        super().__init__()
        self.voiced_thr = voiced_threshold
        self.log_scale = log_scale
        self.eps = eps

    def forward(
        self,
        pred_hz: torch.Tensor,        # (B, T) — predicted f0 in Hz
        target_hz: torch.Tensor,      # (B, T) — reference f0 in Hz
        confidence: torch.Tensor,     # (B, T) — frame-level confidence [0, 1]
    ) -> torch.Tensor:
        voiced = confidence >= self.voiced_thr  # (B, T) bool mask

        if voiced.sum() == 0:
            return pred_hz.sum() * 0.0   # zero loss, preserve grad graph

        if self.log_scale:
            pred   = torch.log(pred_hz.clamp(min=self.eps))
            target = torch.log(target_hz.clamp(min=self.eps))
        else:
            pred, target = pred_hz, target_hz

        abs_err = torch.abs(pred - target)                        # (B, T)
        weighted = confidence.clamp(0.0, 1.0) * abs_err           # (B, T)
        loss = weighted[voiced].mean()
        return loss


class VoicingLoss(nn.Module):
    """Binary cross-entropy for voicing (voiced/unvoiced) prediction."""

    def __init__(self, pos_weight: float = 2.0):
        super().__init__()
        self.bce = nn.BCEWithLogitsLoss(
            pos_weight=torch.tensor([pos_weight])
        )

    def forward(
        self,
        pred_logits: torch.Tensor,    # (B, T) — raw logits
        target_voiced: torch.Tensor,  # (B, T) — binary 0/1
    ) -> torch.Tensor:
        return self.bce(pred_logits, target_voiced.float())


class MultiTaskLoss(nn.Module):
    """
    Combined loss for multi-task learning:
      pitch_loss * w_pitch + voicing_loss * w_voicing + vibrato_loss * w_vibrato

    Weights are learnable via uncertainty-based loss balancing (Kendall et al.)
    """

    def __init__(
        self,
        w_pitch: float = 1.0,
        w_voicing: float = 0.5,
        w_vibrato: float = 0.25,
        learnable_weights: bool = True,
    ):
        super().__init__()
        self.pitch_loss   = ConfidenceWeightedPitchLoss()
        self.voicing_loss = VoicingLoss()

        if learnable_weights:
            # Log-variance uncertainty weighting (Kendall et al., 2018)
            self.log_var_pitch   = nn.Parameter(torch.zeros(1))
            self.log_var_voicing = nn.Parameter(torch.zeros(1))
            self.log_var_vibrato = nn.Parameter(torch.zeros(1))
        else:
            self.register_buffer("log_var_pitch",   torch.zeros(1))
            self.register_buffer("log_var_voicing", torch.zeros(1))
            self.register_buffer("log_var_vibrato", torch.zeros(1))

        self.fixed_w_pitch   = w_pitch
        self.fixed_w_voicing = w_voicing
        self.fixed_w_vibrato = w_vibrato

    def forward(
        self,
        pred_hz: torch.Tensor,
        target_hz: torch.Tensor,
        confidence: torch.Tensor,
        voicing_logits: Optional[torch.Tensor] = None,
        target_voiced: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        # Pitch loss
        p_loss = self.pitch_loss(pred_hz, target_hz, confidence)
        prec_p = torch.exp(-self.log_var_pitch)
        total = prec_p * p_loss + 0.5 * self.log_var_pitch

        # Voicing loss
        if voicing_logits is not None and target_voiced is not None:
            v_loss = self.voicing_loss(voicing_logits, target_voiced)
            prec_v = torch.exp(-self.log_var_voicing)
            total = total + prec_v * v_loss + 0.5 * self.log_var_voicing

        return total
