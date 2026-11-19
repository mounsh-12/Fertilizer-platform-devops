
import os
import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest

DATA_FILE = "metrics_history.csv"
MODEL_FILE = "anomaly_model.joblib"

def train_model():
    if not os.path.exists(DATA_FILE):
        print("Metrics history not found. Run metrics_collector.py first.")
        return

    df = pd.read_csv(DATA_FILE)

    if df.empty:
        print("No metrics available.")
        return

    # Use numeric metrics as model features
    pivot = df.pivot_table(
        index="timestamp",
        columns="metric",
        values="value",
        aggfunc="mean"
    ).sort_index()

    pivot = pivot.dropna()

    if len(pivot) < 10:
        print(f"Need at least 10 complete metric samples. Found {len(pivot)}.")
        return

    model = IsolationForest(
        n_estimators=100,
        contamination=0.05,
        random_state=42
    )

    model.fit(pivot)

    pivot["anomaly"] = model.predict(pivot)
    pivot["anomaly_score"] = model.decision_function(pivot)

    joblib.dump(
        {"model": model, "features": list(pivot.drop(
            columns=["anomaly", "anomaly_score"]
        ).columns)},
        MODEL_FILE
    )

    anomalies = pivot[pivot["anomaly"] == -1]

    print(f"Training samples: {len(pivot)}")
    print(f"Anomalies detected: {len(anomalies)}")
    print("\nLatest results:")
    print(pivot.tail(10).to_string())


if __name__ == "__main__":
    train_model()
