"""
Capteur virtuel (soft sensor) du P80 de la surverse des hydrocyclones.

Entraîne et compare quatre modèles (moyenne, Ridge, Random Forest, XGBoost)
sur les données du jumeau numérique (data/), avec un découpage chronologique
train / validation / test, puis produit les métriques et les figures du rapport.

Usage :
    python ml/soft_sensor_p80/train_xgboost.py
"""
import json
import time
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
OUT_DIR = Path(__file__).resolve().parent / "results"
OUT_DIR.mkdir(parents=True, exist_ok=True)

TARGET = "Output Slurry P80"
SEED = 42

# Mesures disponibles en ligne sur un circuit réel : débitmètres, densimètres
# (fractions solides) et signaux de santé des équipements.
PROCESS_ONLINE = [
    "Feed Solid Flow",
    "Feed Solid Fraction",
    "Process Water Solid Flow",
    "Cyclone Feed Solid Flow",
    "Cyclone Feed Solid Fraction",
    "Cyclone Underflow Solid Flow",
    "Cyclone Underflow Solid Fraction",
    "Ball Mill Discharge Solid Flow",
    "Ball Mill Discharge Solid Fraction",
    "Output Slurry Solid Flow",
    "Output Slurry Solid Fraction",
]
# Caractérisation de l'alimentation fraîche (analyse amont).
FEED_CHARACTERISATION = ["Feed P80", "Feed BPL"]
# Exclues volontairement (fuite d'information) : tous les P80 et BPL aval,
# Mill_Reduction_Ratio (calculé à partir du P80) et Circulating_Load_Ratio_pct.


def load_dataset() -> pd.DataFrame:
    """Joint chaque mesure procédé (15 min) à la moyenne des signaux de santé
    (1 min) sur la fenêtre de 15 min qui la précède."""
    process = pd.read_csv(DATA_DIR / "process_flow_timeseries.csv", parse_dates=["Timestamp"])
    health = pd.read_csv(DATA_DIR / "machine_health_timeseries.csv", parse_dates=["Timestamp"])
    health_15 = (
        health.drop(columns=["RecordNo", "ElapsedMin"])
        .set_index("Timestamp")
        .resample("15min", label="right", closed="right")
        .mean()
    )
    df = process.set_index("Timestamp").join(health_15, how="left")
    return df.dropna(subset=[TARGET]).fillna(method="ffill").fillna(method="bfill")


def health_columns(df: pd.DataFrame) -> list:
    return [c for c in df.columns if c.startswith(("PB001_", "SP001_", "BM001_", "CY001_", "Ambient_"))]


def metrics(y_true, y_pred) -> dict:
    return {
        "R2": float(r2_score(y_true, y_pred)),
        "RMSE": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "MAE": float(mean_absolute_error(y_true, y_pred)),
        "MAPE_pct": float(np.mean(np.abs((y_true - y_pred) / y_true)) * 100),
    }


def chrono_split(n: int):
    i_train, i_val = int(n * 0.70), int(n * 0.85)
    return slice(0, i_train), slice(i_train, i_val), slice(i_val, n)


def tune_xgboost(X_tr, y_tr, X_va, y_va):
    """Petite recherche de grille, arrêt anticipé sur la validation."""
    best = None
    for depth in (3, 4, 6):
        for lr in (0.03, 0.1):
            for subsample in (0.8, 1.0):
                model = XGBRegressor(
                    n_estimators=2000, max_depth=depth, learning_rate=lr,
                    subsample=subsample, colsample_bytree=0.8, min_child_weight=3,
                    reg_lambda=1.0, random_state=SEED, n_jobs=2,
                    early_stopping_rounds=50, eval_metric="rmse",
                )
                model.fit(X_tr, y_tr, eval_set=[(X_va, y_va)], verbose=False)
                rmse = float(np.sqrt(mean_squared_error(y_va, model.predict(X_va))))
                if best is None or rmse < best["val_rmse"]:
                    best = {"val_rmse": rmse, "max_depth": depth, "learning_rate": lr,
                            "subsample": subsample, "n_estimators": int(model.best_iteration) + 1}
    return best


def run_scenario(name: str, df: pd.DataFrame, features: list) -> dict:
    X, y = df[features].astype(float), df[TARGET].astype(float)
    tr, va, te = chrono_split(len(df))
    X_tr, y_tr, X_va, y_va, X_te, y_te = X.iloc[tr], y.iloc[tr], X.iloc[va], y.iloc[va], X.iloc[te], y.iloc[te]
    X_trva, y_trva = X.iloc[: te.start], y.iloc[: te.start]

    best = tune_xgboost(X_tr, y_tr, X_va, y_va)
    xgb_params = dict(n_estimators=best["n_estimators"], max_depth=best["max_depth"],
                      learning_rate=best["learning_rate"], subsample=best["subsample"],
                      colsample_bytree=0.8, min_child_weight=3, reg_lambda=1.0,
                      random_state=SEED, n_jobs=2)

    models = {
        "Moyenne (référence)": None,
        "Régression Ridge": make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
        # Mêmes hyperparamètres que le simulateur What-If du backend.
        "Random Forest": RandomForestRegressor(n_estimators=100, max_depth=22, min_samples_leaf=2,
                                               random_state=SEED, n_jobs=2),
        "XGBoost": XGBRegressor(**xgb_params),
    }

    results, preds = {}, {}
    for label, model in models.items():
        if model is None:
            pred = np.full(len(y_te), y_trva.mean())
        else:
            model.fit(X_trva, y_trva)
            pred = model.predict(X_te)
        preds[label] = pred
        results[label] = metrics(y_te.values, pred)

    # Validation croisée temporelle (5 plis) pour mesurer la stabilité de XGBoost.
    cv_r2, cv_rmse = [], []
    for tr_idx, te_idx in TimeSeriesSplit(n_splits=5).split(X):
        m = XGBRegressor(**xgb_params).fit(X.iloc[tr_idx], y.iloc[tr_idx])
        p = m.predict(X.iloc[te_idx])
        cv_r2.append(r2_score(y.iloc[te_idx], p))
        cv_rmse.append(np.sqrt(mean_squared_error(y.iloc[te_idx], p)))

    # Empreinte et latence d'inférence (une observation à la fois, comme en temps réel).
    footprint = {}
    for label in ("Random Forest", "XGBoost"):
        path = OUT_DIR / f"_tmp_{label.replace(' ', '_')}.joblib"
        joblib.dump(models[label], path)
        size_mb = path.stat().st_size / 1e6
        path.unlink()
        row = X_te.iloc[[0]]
        models[label].predict(row)
        t0 = time.perf_counter()
        for _ in range(200):
            models[label].predict(row)
        footprint[label] = {"size_MB": round(size_mb, 3),
                            "latency_ms": round((time.perf_counter() - t0) / 200 * 1000, 3)}

    xgb = models["XGBoost"]
    importance = pd.Series(xgb.get_booster().get_score(importance_type="gain")).reindex(features).fillna(0)
    importance = (importance / importance.sum()).sort_values(ascending=False)

    return {
        "name": name, "features": features, "n_features": len(features),
        "n_train": int(len(X_tr)), "n_val": int(len(X_va)), "n_test": int(len(X_te)),
        "test_period": [str(X_te.index[0]), str(X_te.index[-1])],
        "xgb_best_params": best, "test_metrics": results,
        "xgb_cv": {"R2_mean": float(np.mean(cv_r2)), "R2_std": float(np.std(cv_r2)),
                   "RMSE_mean": float(np.mean(cv_rmse)), "RMSE_std": float(np.std(cv_rmse))},
        "importance": importance.round(4).to_dict(), "footprint": footprint,
        "_y_test": y_te, "_preds": preds, "_model": xgb,
    }


def plot_all(scen_a: dict, scen_b: dict):
    plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False})
    blue, orange, grey = "#1F4E79", "#E65100", "#888888"

    for s, tag in ((scen_a, "A"), (scen_b, "B")):
        y, p = s["_y_test"], s["_preds"]["XGBoost"]
        r = s["test_metrics"]["XGBoost"]

        fig, ax = plt.subplots(figsize=(9, 3.4))
        ax.plot(y.index, y.values, color=grey, lw=1.2, label="P80 mesuré")
        ax.plot(y.index, p, color=blue, lw=1.2, label="P80 estimé (XGBoost)")
        ax.set_ylabel("P80 surverse (µm)")
        ax.set_title(f"Scénario {tag} — jeu de test (R² = {r['R2']:.3f}, RMSE = {r['RMSE']:.2f} µm)")
        ax.legend(frameon=False, loc="upper left")
        fig.autofmt_xdate()
        fig.tight_layout()
        fig.savefig(OUT_DIR / f"p80_timeseries_{tag}.png", dpi=200)
        plt.close(fig)

        fig, ax = plt.subplots(figsize=(4.2, 4.2))
        lo, hi = min(y.min(), p.min()) - 1, max(y.max(), p.max()) + 1
        ax.plot([lo, hi], [lo, hi], color=grey, ls="--", lw=1)
        ax.scatter(y, p, s=10, alpha=0.6, color=blue, edgecolor="none")
        ax.set_xlim(lo, hi); ax.set_ylim(lo, hi)
        ax.set_xlabel("P80 mesuré (µm)"); ax.set_ylabel("P80 estimé (µm)")
        ax.set_title(f"Scénario {tag}")
        fig.tight_layout()
        fig.savefig(OUT_DIR / f"p80_parity_{tag}.png", dpi=200)
        plt.close(fig)

    imp = pd.Series(scen_b["importance"]).head(10)[::-1]
    fig, ax = plt.subplots(figsize=(6.5, 3.6))
    ax.barh(imp.index, imp.values * 100, color=blue)
    ax.set_xlabel("Importance (gain, % du total)")
    ax.set_title("XGBoost — importance des variables (scénario B)")
    fig.tight_layout()
    fig.savefig(OUT_DIR / "xgb_feature_importance.png", dpi=200)
    plt.close(fig)

    labels = list(scen_a["test_metrics"].keys())
    x = np.arange(len(labels)); w = 0.38
    fig, ax = plt.subplots(figsize=(7, 3.4))
    ra = [max(scen_a["test_metrics"][l]["R2"], 0) for l in labels]
    rb = [max(scen_b["test_metrics"][l]["R2"], 0) for l in labels]
    ax.bar(x - w / 2, ra, w, color=grey, label="A : capteurs en ligne")
    ax.bar(x + w / 2, rb, w, color=blue, label="B : + caractérisation alimentation")
    for xi, v in zip(x - w / 2, ra): ax.text(xi, v + 0.01, f"{v:.2f}", ha="center", fontsize=8)
    for xi, v in zip(x + w / 2, rb): ax.text(xi, v + 0.01, f"{v:.2f}", ha="center", fontsize=8)
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel("R² sur le jeu de test"); ax.set_ylim(0, 1.08)
    ax.legend(frameon=False, fontsize=8, loc="upper left")
    fig.tight_layout()
    fig.savefig(OUT_DIR / "models_r2_comparison.png", dpi=200)
    plt.close(fig)


def main():
    df = load_dataset()
    online = PROCESS_ONLINE + health_columns(df)
    scen_a = run_scenario("A - capteurs en ligne", df, online)
    scen_b = run_scenario("B - capteurs en ligne + caractérisation alimentation", df, online + FEED_CHARACTERISATION)

    plot_all(scen_a, scen_b)
    bundle = {"model": scen_b["_model"], "features": scen_b["features"], "target": TARGET,
              "health_window_min": 15, "test_metrics": scen_b["test_metrics"]["XGBoost"],
              "test_period": scen_b["test_period"]}
    joblib.dump(bundle, OUT_DIR / "xgb_soft_sensor_p80.joblib")
    # Copie servie par le backend (dossier data/ monté dans le conteneur).
    (DATA_DIR / "models").mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, DATA_DIR / "models" / "xgb_soft_sensor_p80.joblib")

    report = {
        "target": TARGET, "n_rows": int(len(df)),
        "period": [str(df.index[0]), str(df.index[-1])],
        "target_stats": df[TARGET].describe().round(3).to_dict(),
        "scenarios": [{k: v for k, v in s.items() if not k.startswith("_")} for s in (scen_a, scen_b)],
    }
    (OUT_DIR / "metrics.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    for s in (scen_a, scen_b):
        print(f"\n=== {s['name']} ({s['n_features']} variables) ===")
        for label, m in s["test_metrics"].items():
            print(f"{label:22s} R2={m['R2']:.3f}  RMSE={m['RMSE']:.3f}  MAE={m['MAE']:.3f}  MAPE={m['MAPE_pct']:.2f}%")
        cv = s["xgb_cv"]
        print(f"XGBoost CV 5 plis : R2={cv['R2_mean']:.3f} ± {cv['R2_std']:.3f}  RMSE={cv['RMSE_mean']:.3f} ± {cv['RMSE_std']:.3f}")
        print("Meilleurs hyperparamètres :", s["xgb_best_params"])
        print("Top 5 importances :", list(s["importance"].items())[:5])
        print("Empreinte :", s["footprint"])


if __name__ == "__main__":
    main()
