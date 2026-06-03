"""
Phase 3: Role-Type Conditioning for Jingju Singing Intelligence

Maps Jingju 行当 (role categories) to learnable embeddings that condition
all downstream models — pitch, vibrato, timbre, ornamentation, expression.

Role-specific behavior it enables:
  Dan   (旦)  — high falsetto 小嗓, narrow vibrato, bright centroid
  Sheng (生)  — mixed register, moderate vibrato, mid-range
  Jing  (净)  — deep 大嗓 chest voice, wide resonance, low centroid
  Chou  (丑)  — speech-like, flexible, wide dynamic range
"""

import torch
import torch.nn as nn
from typing import Optional, Union

# Canonical role name → integer index
ROLE_TO_IDX = {
    # Dan roles
    "dan": 0, "qingyi": 0, "huadan": 1, "wudan": 2, "laodan": 3, "daomadan": 4,
    # Sheng roles
    "sheng": 5, "laosheng": 5, "xiaosheng": 6, "wusheng": 7,
    # Jing roles
    "jing": 8, "dahualian": 8, "erhualian": 9,
    # Chou roles
    "chou": 10, "wenchou": 10, "wuchou": 11,
    # Fallback
    "unknown": 12, "default": 12,
}

NUM_ROLES = 13
EMBED_DIM = 64   # role embedding dimension fed into encoder / decoders


class RoleEmbedding(nn.Module):
    """
    Learnable role embedding table.

    Usage:
        emb = RoleEmbedding()
        role_vec = emb("qingyi")          # → (1, EMBED_DIM) tensor
        role_vec = emb(torch.tensor([0])) # → (1, EMBED_DIM) tensor
    """

    def __init__(self, num_roles: int = NUM_ROLES, embed_dim: int = EMBED_DIM):
        super().__init__()
        self.embed_dim = embed_dim
        self.table = nn.Embedding(num_roles, embed_dim)
        nn.init.normal_(self.table.weight, mean=0.0, std=0.02)

    def forward(
        self,
        role: Union[str, int, torch.Tensor],
        device: str = "cpu",
    ) -> torch.Tensor:
        """
        Returns (1, embed_dim) role embedding.
        Accepts: role name string, integer index, or 1-D LongTensor.
        """
        if isinstance(role, str):
            idx = ROLE_TO_IDX.get(role.lower(), ROLE_TO_IDX["default"])
            role_t = torch.tensor([idx], dtype=torch.long, device=device)
        elif isinstance(role, int):
            role_t = torch.tensor([role], dtype=torch.long, device=device)
        else:
            role_t = role.to(device)

        return self.table(role_t)   # (1, embed_dim)

    def batch_embed(self, roles: list, device: str = "cpu") -> torch.Tensor:
        """Returns (B, embed_dim) embeddings for a batch of role names/indices."""
        indices = [
            ROLE_TO_IDX.get(r.lower() if isinstance(r, str) else r,
                            ROLE_TO_IDX["default"])
            for r in roles
        ]
        t = torch.tensor(indices, dtype=torch.long, device=device)
        return self.table(t)


def role_name_to_idx(role: Optional[str]) -> int:
    """Utility: convert a role name string to integer index (no-grad, no model needed)."""
    if role is None:
        return ROLE_TO_IDX["default"]
    return ROLE_TO_IDX.get(role.lower(), ROLE_TO_IDX["default"])
