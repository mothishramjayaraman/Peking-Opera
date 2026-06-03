"""
Jingju AI Singing System — Visualization Module

Generates:
  - Waveform plots
  - Mel spectrogram overlays
  - Pitch contour plots with confidence heatmap
  - Vibrato analysis graphs
  - Harmonic spectrogram visualization
  - Ornament event markers
"""

import numpy as np
import matplotlib
matplotlib.use("Agg")   # non-interactive backend for server use
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import librosa
import librosa.display
import io
import logging
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)


class JingjuVisualizer:
    """
    Produces publication-quality plots for Jingju pitch intelligence.
    All methods return PNG bytes for embedding in API responses or saving to disk.
    """

    def __init__(self, sr: int = 22050, hop_length: int = 512, dpi: int = 150):
        self.sr = sr
        self.hop_length = hop_length
        self.dpi = dpi
        self.frame_time = hop_length / sr

    # ── Public API ───────────────────────────────────────────────────────────────

    def plot_pitch_contour(
        self,
        y: np.ndarray,
        f0: np.ndarray,
        confidence: np.ndarray,
        title: str = "Jingju Pitch Contour",
        role: str = "default",
        ornament_events: Optional[List[Dict]] = None,
        save_path: Optional[str] = None,
    ) -> bytes:
        """
        4-panel figure:
          Panel 1 — Waveform
          Panel 2 — Mel Spectrogram + pitch overlay
          Panel 3 — Pitch contour coloured by confidence
          Panel 4 — Confidence heatmap
        """
        fig, axes = plt.subplots(4, 1, figsize=(14, 10), dpi=self.dpi)
        fig.suptitle(title, fontsize=13, fontweight="bold")

        times_audio = np.linspace(0, len(y) / self.sr, len(y))
        frame_times = np.arange(len(f0)) * self.frame_time

        # Panel 1: Waveform
        ax = axes[0]
        ax.plot(times_audio, y, linewidth=0.4, color="#4a90d9", alpha=0.8)
        ax.set_ylabel("Amplitude", fontsize=8)
        ax.set_xlim(0, len(y) / self.sr)
        ax.set_title("Waveform", fontsize=9)
        ax.tick_params(labelsize=7)

        # Panel 2: Mel Spectrogram + pitch overlay
        ax = axes[1]
        S = librosa.feature.melspectrogram(y=y, sr=self.sr, hop_length=self.hop_length, n_mels=80)
        S_db = librosa.power_to_db(S, ref=np.max)
        img = librosa.display.specshow(S_db, sr=self.sr, hop_length=self.hop_length,
                                        x_axis="time", y_axis="mel", ax=ax,
                                        fmin=80, fmax=1047, cmap="magma")
        plt.colorbar(img, ax=ax, format="%+2.0f dB", pad=0.01)

        voiced = (confidence >= 0.45) & (f0 > 0)
        if voiced.sum() > 0:
            ax.scatter(frame_times[voiced], f0[voiced], s=1.5,
                       c=confidence[voiced], cmap="RdYlGn",
                       vmin=0.3, vmax=1.0, alpha=0.8, zorder=5)
        ax.set_title("Mel Spectrogram + Pitch", fontsize=9)
        ax.tick_params(labelsize=7)

        # Panel 3: Pitch contour coloured by confidence
        ax = axes[2]
        voiced_f0 = np.where(voiced, f0, np.nan)
        sc = ax.scatter(frame_times, voiced_f0, s=3,
                        c=confidence, cmap="RdYlGn", vmin=0, vmax=1, alpha=0.9)
        plt.colorbar(sc, ax=ax, label="Confidence", pad=0.01)

        # Jingju role zone bands
        self._draw_role_zones(ax, role)

        # Ornament event markers
        if ornament_events:
            for ev in ornament_events:
                ax.axvspan(ev["start_time"], ev["end_time"],
                           alpha=0.2, color="cyan", zorder=1)
                ax.text(ev["start_time"], ax.get_ylim()[1] * 0.95,
                        ev.get("ornament_type", "?")[:3],
                        fontsize=6, color="blue", rotation=90)

        ax.set_ylabel("F0 (Hz)", fontsize=8)
        ax.set_xlabel("Time (s)", fontsize=8)
        ax.set_title(f"Pitch Contour — {role.upper()}", fontsize=9)
        ax.tick_params(labelsize=7)

        # Panel 4: Confidence heatmap
        ax = axes[3]
        conf_2d = confidence[np.newaxis, :]
        im = ax.imshow(conf_2d, aspect="auto", origin="lower",
                       extent=[0, frame_times[-1], 0, 1],
                       cmap="RdYlGn", vmin=0, vmax=1)
        plt.colorbar(im, ax=ax, label="Confidence", pad=0.01)
        ax.set_ylabel("Conf.", fontsize=8)
        ax.set_xlabel("Time (s)", fontsize=8)
        ax.set_title("Confidence Heatmap", fontsize=9)
        ax.tick_params(labelsize=7)

        plt.tight_layout()
        return self._fig_to_bytes(fig, save_path)

    def plot_vibrato_analysis(
        self,
        f0: np.ndarray,
        confidence: np.ndarray,
        vibrato_result: Dict,
        title: str = "Vibrato Analysis",
        save_path: Optional[str] = None,
    ) -> bytes:
        """2-panel: detrended modulation + FFT spectrum."""
        fig, axes = plt.subplots(2, 1, figsize=(12, 6), dpi=self.dpi)
        fig.suptitle(title, fontsize=12)

        dt = self.frame_time
        voiced = (confidence >= 0.45) & (f0 > 0)
        frame_times = np.arange(len(f0)) * dt

        # Compute detrended modulation
        from scipy.signal import medfilt
        f0_safe = np.where(voiced, f0, np.nan)
        valid = ~np.isnan(f0_safe)
        if valid.sum() > 10:
            idx = np.arange(len(f0_safe))
            f0_interp = np.interp(idx, idx[valid], f0_safe[valid])
            cents = 1200 * np.log2(np.maximum(f0_interp, 1e-6) / 440.0)
            win = max(5, int(0.20 / dt))
            win = win if win % 2 == 1 else win + 1
            trend = medfilt(cents, kernel_size=win)
            modulation = cents - trend
        else:
            modulation = np.zeros_like(f0, dtype=float)

        # Panel 1: Modulation contour
        axes[0].plot(frame_times, modulation, linewidth=1.0, color="#e74c3c", alpha=0.8)
        axes[0].axhline(0, color="gray", linewidth=0.5, linestyle="--")
        axes[0].set_ylabel("Modulation (cents)", fontsize=8)
        axes[0].set_title(
            f"Vibrato Modulation — rate={vibrato_result.get('vibrato_rate_hz',0):.2f}Hz  "
            f"depth={vibrato_result.get('vibrato_depth_cents',0):.1f}¢  "
            f"stability={vibrato_result.get('vibrato_stability',0):.3f}",
            fontsize=9
        )

        # Panel 2: FFT spectrum of modulation
        n = len(modulation)
        freqs = np.fft.rfftfreq(n, d=dt)
        mag   = np.abs(np.fft.rfft(modulation))
        axes[1].plot(freqs[:int(len(freqs) * 0.3)], mag[:int(len(mag) * 0.3)],
                     linewidth=1.0, color="#3498db")
        axes[1].axvspan(4.5, 9.5, alpha=0.15, color="green", label="Vibrato zone")
        axes[1].set_xlabel("Frequency (Hz)", fontsize=8)
        axes[1].set_ylabel("Magnitude", fontsize=8)
        axes[1].set_title("Modulation Spectrum", fontsize=9)
        axes[1].legend(fontsize=7)

        plt.tight_layout()
        return self._fig_to_bytes(fig, save_path)

    def plot_harmonic_analysis(
        self,
        y: np.ndarray,
        f0: np.ndarray,
        confidence: np.ndarray,
        n_harmonics: int = 8,
        title: str = "Harmonic Analysis",
        save_path: Optional[str] = None,
    ) -> bytes:
        """CQT spectrogram with harmonic lines overlaid."""
        fig, ax = plt.subplots(figsize=(14, 5), dpi=self.dpi)

        C = librosa.cqt(y=y, sr=self.sr, hop_length=self.hop_length, n_bins=84)
        C_db = librosa.amplitude_to_db(np.abs(C), ref=np.max)
        librosa.display.specshow(C_db, sr=self.sr, hop_length=self.hop_length,
                                  x_axis="time", y_axis="cqt_hz", ax=ax, cmap="viridis")

        # Overlay fundamental + harmonics
        frame_times = np.arange(len(f0)) * self.frame_time
        voiced = (confidence >= 0.45) & (f0 > 0)
        colors = plt.cm.cool(np.linspace(0, 1, n_harmonics))
        for h in range(1, n_harmonics + 1):
            harm_f0 = np.where(voiced, f0 * h, np.nan)
            ax.plot(frame_times, harm_f0, linewidth=0.8, color=colors[h - 1],
                    alpha=0.7, label=f"H{h}" if h <= 4 else "")

        ax.legend(fontsize=7, loc="upper right")
        ax.set_title(title, fontsize=10)
        ax.set_ylabel("Frequency (Hz)", fontsize=8)
        ax.set_xlabel("Time (s)", fontsize=8)

        plt.tight_layout()
        return self._fig_to_bytes(fig, save_path)

    # ── Helpers ─────────────────────────────────────────────────────────────────

    def _draw_role_zones(self, ax, role: str):
        """Draw horizontal bands for the role's expected tessiture."""
        zones = {
            "dan":      (261, 880, "#ff69b4"),
            "qingyi":   (261, 784, "#ff69b4"),
            "huadan":   (294, 880, "#ff69b4"),
            "sheng":    (98,  392, "#87ceeb"),
            "laosheng": (98,  294, "#87ceeb"),
            "jing":     (65,  220, "#90ee90"),
            "chou":     (98,  523, "#ffa500"),
        }
        if role in zones:
            lo, hi, colour = zones[role]
            ax.axhspan(lo, hi, alpha=0.05, color=colour, zorder=0)

    def _fig_to_bytes(self, fig: plt.Figure, save_path: Optional[str] = None) -> bytes:
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", dpi=self.dpi)
        plt.close(fig)
        buf.seek(0)
        data = buf.read()
        if save_path:
            with open(save_path, "wb") as f:
                f.write(data)
        return data
