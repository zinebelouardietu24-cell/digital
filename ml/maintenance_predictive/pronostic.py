"""
Maintenance prédictive : détection des interventions, modèle de dégradation
et pronostic de durée de vie résiduelle (RUL) des équipements critiques.

Étapes :
  1. Détecter automatiquement les interventions dans les signaux de santé
     (chute brutale d'un indicateur d'usure) et les rapprocher de la GMAO
     (data/maintenance_history.csv).
  2. Modéliser la dégradation de chaque cycle (entre deux interventions).
  3. Valider le pronostic a posteriori (backtest) : à chaque heure d'un cycle
     terminé, on estime la date à laquelle l'indicateur atteindra le niveau
     auquel l'intervention a eu lieu, avec les seules données disponibles à
     cet instant, puis on compare à la date réelle.
  4. Pronostiquer, à la fin des données, la date à laquelle chaque
     indicateur atteindra son seuil d'alarme.

Usage :
    python ml/maintenance_predictive/pronostic.py
"""
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
OUT_DIR = Path(__file__).resolve().parent / "results"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Indicateur d'usure suivi par équipement, et seuil d'alarme retenu.
INDICATEURS = {
    "SP_001": {
        "colonne": "SP001_Vibration_mms", "nom": "Pompe SP_001 - vibration", "unite": "mm/s",
        # ISO 10816-3, groupe 2 (15-300 kW), fondation rigide : frontière zone B/C.
        "seuil": 2.8, "source_seuil": "ISO 10816-3, groupe 2, limite des zones B/C",
    },
    "BM_001": {
        "colonne": "BM001_Vibration_mms", "nom": "Broyeur BM_001 - vibration", "unite": "mm/s",
        # ISO 10816-3, groupe 1 (> 300 kW), fondation rigide : frontière zone B/C.
        "seuil": 4.5, "source_seuil": "ISO 10816-3, groupe 1, limite des zones B/C",
    },
    "CY_001": {
        "colonne": "CY001_Apex_Wear_Index_pct", "nom": "Hydrocyclones CY_001 - usure des apex", "unite": "%",
        # Niveau auquel les apex ont été remplacés le 19/07 (GMAO WO CY_001_A/B).
        "seuil": 50.0, "source_seuil": "niveau de remplacement observé le 19/07/2026",
    },
}
SAUT_MIN_SIGMA = 8          # une intervention = chute horaire > 8 écarts-types du bruit
MIN_HISTO_H = 12            # données minimales dans un cycle avant de pronostiquer
NIVEAU_Z = 1.645            # intervalle de prédiction à 90 %
COLORS = {"SP_001": "#1F4E79", "BM_001": "#2E7D32", "CY_001": "#6A1B9A"}


def charger():
    h = pd.read_csv(DATA_DIR / "machine_health_timeseries.csv", parse_dates=["Timestamp"]).set_index("Timestamp")
    gmao = pd.read_csv(DATA_DIR / "maintenance_history.csv", parse_dates=["maintenance_date"])
    gmao["equipement"] = gmao["equipment_id"].str.slice(0, 6)   # CY_001_A -> CY_001
    return h.resample("1h").mean(), gmao


def detecter_interventions(serie: pd.Series) -> list:
    d = serie.diff()
    bruit = 1.4826 * (d - d.median()).abs().median()            # écart-type robuste (MAD)
    sauts = d[d < -SAUT_MIN_SIGMA * bruit].index
    events = []
    for t in sauts:
        if not events or (t - events[-1]) > pd.Timedelta(hours=24):
            events.append(t)
    return events


def ajuster(t_h: np.ndarray, v: np.ndarray):
    """Régression linéaire v = a + b t, avec l'erreur-type de la pente."""
    A = np.vstack([np.ones_like(t_h), t_h]).T
    coef, *_ = np.linalg.lstsq(A, v, rcond=None)
    resid = v - A @ coef
    s2 = resid @ resid / max(len(v) - 2, 1)
    cov = s2 * np.linalg.inv(A.T @ A)
    r2 = 1 - (resid @ resid) / (((v - v.mean()) ** 2).sum() or 1)
    return coef[0], coef[1], float(np.sqrt(cov[1, 1])), float(r2)


def temps_franchissement(a, b, se_b, t_now, seuil):
    """Heures restantes avant d'atteindre le seuil (valeur centrale et bornes à 90 %)."""
    if b <= 0:
        return np.inf, np.inf, np.inf
    def rul(pente):
        return max((seuil - a) / pente - t_now, 0.0) if pente > 0 else np.inf
    return rul(b), rul(b + NIVEAU_Z * se_b), rul(max(b - NIVEAU_Z * se_b, 1e-9))


def main():
    h, gmao = charger()
    debut, fin = h.index[0], h.index[-1]
    resultats = {"periode": [str(debut), str(fin)], "equipements": {}}
    backtest_rows = []
    figure_data = {}

    for eq, cfg in INDICATEURS.items():
        s = h[cfg["colonne"]].dropna()
        events = detecter_interventions(s)

        # Rapprochement avec la GMAO (même équipement, à 24 h près).
        ot = gmao[(gmao["equipement"] == eq) & (gmao["maintenance_date"] >= debut.normalize())]
        rapprochement = []
        for t in events:
            match = ot[(ot["maintenance_date"] - t.normalize()).abs() <= pd.Timedelta(days=1)]
            rapprochement.append({
                "date": str(t), "dans_gmao": bool(len(match)),
                "ordres_de_travail": match["log_id"].tolist(),
                "type": match["maintenance_type"].tolist(),
            })

        # Cycles. Le premier commence au début des données : on l'utilise
        # seulement si l'indicateur y part du même niveau qu'après une intervention.
        bornes = [debut] + events + [fin + pd.Timedelta(hours=1)]
        niveau_neuf = np.mean([s[t:t + pd.Timedelta(hours=6)].mean() for t in events]) if events else None
        cycles = []
        for i in range(len(bornes) - 1):
            seg = s[bornes[i]:bornes[i + 1] - pd.Timedelta(hours=1)]
            t_h = (seg.index - seg.index[0]).total_seconds().values / 3600
            a, b, se_b, r2 = ajuster(t_h, seg.values)
            depart_neuf = i > 0 or (niveau_neuf is not None and abs(seg.iloc[:6].mean() - niveau_neuf)
                                     < 3 * seg.diff().std() * np.sqrt(6))
            termine = i < len(bornes) - 2
            cycles.append({
                "debut": str(seg.index[0]), "fin": str(seg.index[-1]), "duree_j": round(len(seg) / 24, 2),
                "niveau_initial": round(float(seg.iloc[:6].mean()), 3),
                "niveau_final": round(float(seg.iloc[-6:].mean()), 3),
                "pente_par_jour": round(b * 24, 4), "R2_lineaire": round(r2, 4),
                "depart_apres_intervention": bool(depart_neuf), "termine": bool(termine),
            })

            # Backtest : seulement sur les cycles terminés dont le départ est connu.
            if termine and depart_neuf:
                seuil_reel = float(seg.iloc[-6:].mean())
                t_fin = t_h[-1]
                for k in range(MIN_HISTO_H, len(seg) - 1):
                    a_k, b_k, se_k, _ = ajuster(t_h[:k + 1], seg.values[:k + 1])
                    rul_c, rul_lo, rul_hi = temps_franchissement(a_k, b_k, se_k, t_h[k], seuil_reel)
                    backtest_rows.append({
                        "equipement": eq, "cycle": i, "rul_reel_h": t_fin - t_h[k],
                        "rul_predit_h": rul_c, "rul_bas_h": rul_lo, "rul_haut_h": rul_hi,
                    })

        # Pronostic final sur le cycle en cours.
        dernier = s[bornes[-2]:]
        t_h = (dernier.index - dernier.index[0]).total_seconds().values / 3600
        a, b, se_b, r2 = ajuster(t_h, dernier.values)
        rul_c, rul_lo, rul_hi = temps_franchissement(a, b, se_b, t_h[-1], cfg["seuil"])
        date = lambda x: str((fin + pd.Timedelta(hours=x)).date()) if np.isfinite(x) else None
        resultats["equipements"][eq] = {
            "indicateur": cfg["nom"], "unite": cfg["unite"], "seuil": cfg["seuil"],
            "source_seuil": cfg["source_seuil"],
            "interventions_detectees": rapprochement, "cycles": cycles,
            "pronostic": {
                "valeur_actuelle": round(float(dernier.iloc[-6:].mean()), 3),
                "pente_par_jour": round(b * 24, 4),
                "jours_avant_seuil": round(rul_c / 24, 1),
                "intervalle_90_jours": [round(rul_lo / 24, 1), round(rul_hi / 24, 1)],
                "date_prevue": date(rul_c), "date_au_plus_tot": date(rul_lo), "date_au_plus_tard": date(rul_hi),
            },
        }
        figure_data[eq] = (s, events, rapprochement, a, b, se_b, dernier.index[0], rul_c, cfg)

    # --- Synthèse du backtest par horizon.
    bt = pd.DataFrame(backtest_rows)
    bt["erreur_h"] = (bt["rul_predit_h"] - bt["rul_reel_h"]).abs()
    bt["dans_intervalle"] = (bt["rul_reel_h"] >= bt["rul_bas_h"]) & (bt["rul_reel_h"] <= bt["rul_haut_h"])
    horizons = {}
    for label, (lo, hi) in {"7 jours avant": (156, 180), "3 jours avant": (60, 84), "1 jour avant": (12, 36)}.items():
        sel = bt[(bt["rul_reel_h"] >= lo) & (bt["rul_reel_h"] < hi)]
        if len(sel):
            horizons[label] = {"erreur_moyenne_h": round(float(sel["erreur_h"].mean()), 1),
                               "erreur_max_h": round(float(sel["erreur_h"].max()), 1),
                               "n": int(len(sel))}
    resultats["backtest"] = {
        "cycles_evalues": bt.groupby(["equipement", "cycle"]).size().reset_index().shape[0],
        "pronostics_evalues": int(len(bt)),
        "erreur_moyenne_h": round(float(bt["erreur_h"].mean()), 1),
        "erreur_relative_moyenne_pct": round(float((bt["erreur_h"] / bt["rul_reel_h"].clip(lower=1)).mean() * 100), 1),
        "par_horizon": horizons,
    }

    # --- Intervalle à 90 % calibré sur les erreurs relatives du backtest
    # (l'incertitude de la seule pente sous-estime l'erreur réelle).
    utile = bt[bt["rul_reel_h"] >= 24]
    q90 = float(((utile["rul_predit_h"] - utile["rul_reel_h"]).abs() / utile["rul_reel_h"]).quantile(0.90))
    resultats["backtest"]["erreur_relative_q90_pct"] = round(q90 * 100, 1)
    for eq, info in resultats["equipements"].items():
        p = info["pronostic"]
        rul_h = p["jours_avant_seuil"] * 24
        lo, hi = rul_h * (1 - q90), rul_h * (1 + q90)
        p["intervalle_90_jours"] = [round(lo / 24, 1), round(hi / 24, 1)]
        p["date_au_plus_tot"] = str((fin + pd.Timedelta(hours=lo)).date())
        p["date_au_plus_tard"] = str((fin + pd.Timedelta(hours=hi)).date())
        # Marge entre le niveau auquel on intervient aujourd'hui et le seuil d'alarme.
        termines = [c for c in info["cycles"] if c["termine"] and c["depart_apres_intervention"]]
        if termines:
            pente = np.mean([c["pente_par_jour"] for c in info["cycles"]])
            depart = np.mean([c["niveau_initial"] for c in info["cycles"]])
            info["marge"] = {
                "duree_moyenne_cycle_j": round(float(np.mean([c["duree_j"] for c in termines])), 1),
                "niveau_moyen_a_l_intervention": round(float(np.mean([c["niveau_final"] for c in termines])), 3),
                "duree_jusqu_au_seuil_j": round(float((info["seuil"] - depart) / pente), 1),
            }

    (OUT_DIR / "pronostic.json").write_text(json.dumps(resultats, indent=2, ensure_ascii=False, default=str),
                                            encoding="utf-8")

    # --- Figure 1 : signaux, interventions détectées et pronostic.
    plt.rcParams.update({"font.size": 9, "axes.spines.top": False, "axes.spines.right": False})
    fig, axes = plt.subplots(3, 1, figsize=(9, 7.6), sharex=True)
    for ax, (eq, (s, events, rap, a, b, se_b, t0, rul_c, cfg)) in zip(axes, figure_data.items()):
        col = COLORS[eq]
        ax.plot(s.index, s.values, color=col, lw=1)
        for r in rap:
            t = pd.Timestamp(r["date"])
            ax.axvline(t, color="black", lw=1, ls="-" if r["dans_gmao"] else ":")
            ax.text(t, ax.get_ylim()[1] if False else s.max(), " OT" if r["dans_gmao"] else " hors GMAO",
                    fontsize=7, va="top")
        horizon = min(rul_c, 24 * 35) if np.isfinite(rul_c) else 24 * 35
        t_fut = np.arange(0, (fin - t0).total_seconds() / 3600 + horizon + 1)
        dates = [t0 + pd.Timedelta(hours=x) for x in t_fut]
        centre = a + b * t_fut
        bande = NIVEAU_Z * se_b * t_fut
        mask = np.array([d >= fin for d in dates])
        ax.plot(np.array(dates)[mask], centre[mask], color=col, ls="--", lw=1.4)
        ax.fill_between(np.array(dates)[mask], (centre - bande)[mask], (centre + bande)[mask], color=col, alpha=0.15, lw=0)
        ax.axhline(cfg["seuil"], color="#B71C1C", lw=1, ls="--")
        ax.text(s.index[0], cfg["seuil"], f" seuil {cfg['seuil']} {cfg['unite']}", color="#B71C1C", fontsize=7, va="bottom")
        ax.axvspan(fin, dates[-1], color="#F2F2F2", zorder=0)
        ax.set_ylabel(f"{cfg['unite']}")
        ax.set_title(cfg["nom"], loc="left", fontsize=9, fontweight="bold")
    axes[-1].xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
    fig.tight_layout()
    fig.savefig(OUT_DIR / "pronostic_equipements.png", dpi=200)
    plt.close(fig)

    # --- Figure 2 : backtest, RUL prédite vs RUL réelle.
    fig, ax = plt.subplots(figsize=(4.8, 4.4))
    for (eq, cyc), grp in bt.groupby(["equipement", "cycle"]):
        ax.plot(grp["rul_reel_h"] / 24, grp["rul_predit_h"].clip(upper=40 * 24) / 24, lw=1.2,
                color=COLORS[eq], ls="-" if cyc == 0 else "--", label=f"{eq} (cycle {cyc + 1})")
    m = bt["rul_reel_h"].max() / 24
    ax.plot([0, m], [0, m], color="#888888", ls="--", lw=1)
    ax.set_xlabel("Durée de vie résiduelle réelle (jours)")
    ax.set_ylabel("Durée de vie résiduelle prédite (jours)")
    ax.set_xlim(m, 0)
    ax.set_ylim(0, m * 1.4)
    ax.legend(fontsize=7, frameon=False)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "pronostic_backtest.png", dpi=200)
    plt.close(fig)

    print(json.dumps(resultats, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
