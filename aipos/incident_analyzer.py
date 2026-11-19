
import os
import joblib
import pandas as pd
from datetime import datetime, timezone

DATA_FILE = "metrics_history.csv"
MODEL_FILE = "anomaly_model.joblib"
REPORT_FILE = "incident_report.txt"


def analyze_incidents():
    if not os.path.exists(DATA_FILE):
        print("No metrics history found.")
        return

    df = pd.read_csv(DATA_FILE)

    if df.empty:
        print("Metrics history is empty.")
        return

    latest = df.sort_values("timestamp").groupby(
        "metric", as_index=False
    ).tail(1)

    metrics = dict(zip(latest["metric"], latest["value"]))

    incidents = []

    cpu = metrics.get("cpu_usage")
    memory = metrics.get("memory_usage")
    backend = metrics.get("backend_status")
    mysql = metrics.get("mysql_status")

    if cpu is not None and cpu > 80:
        incidents.append(f"HIGH CPU USAGE: {cpu:.2f}%")

    if memory is not None and memory > 85:
        incidents.append(f"HIGH MEMORY USAGE: {memory:.2f}%")

    if backend is not None and backend < 1:
        incidents.append("BACKEND IS UNAVAILABLE")

    if mysql is not None and mysql < 1:
        incidents.append("MYSQL DATABASE IS UNAVAILABLE")

    if os.path.exists(MODEL_FILE):
        saved = joblib.load(MODEL_FILE)
        model = saved["model"]
        features = saved["features"]

        row = latest.set_index("metric")["value"].reindex(features)

        if row.notna().all():
            prediction = model.predict([row.values])[0]

            if prediction == -1:
                incidents.append(
                    "ANOMALY DETECTED BY ISOLATION FOREST"
                )

    if not incidents:
        incidents.append("No incidents detected.")

    report = [
        "SRI BYRAWESWARA TRADERS - AIOPS INCIDENT REPORT",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        *[f"- {incident}" for incident in incidents]
    ]

    content = "\n".join(report)

    with open(REPORT_FILE, "w") as file:
        file.write(content)

    print(content)
    print(f"\nReport saved to {REPORT_FILE}")


if __name__ == "__main__":
    analyze_incidents()
