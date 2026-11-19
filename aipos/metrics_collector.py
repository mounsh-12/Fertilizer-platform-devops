
import os
import requests
import pandas as pd
from datetime import datetime, timezone

OUTPUT_FILE = "metrics_history.csv"

PROMETHEUS_SOURCES = {
    "application": "http://localhost:9090",
    "kubernetes": "http://localhost:9091"
}

QUERIES = {
    "cpu_usage": {
        "source": "kubernetes",
        "query": '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'
    },
    "memory_usage": {
        "source": "kubernetes",
        "query": '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)'
    },
    "backend_status": {
        "source": "application",
        "query": 'up{job="fertilizer-backend"}'
    },
    "mysql_status": {
        "source": "application",
        "query": 'mysql_up'
    }
}


def query_prometheus(url, query):
    try:
        response = requests.get(
            f"{url}/api/v1/query",
            params={"query": query},
            timeout=10
        )
        response.raise_for_status()

        data = response.json()

        if data.get("status") != "success":
            return []

        return data["data"]["result"]

    except requests.RequestException as error:
        print(f"[ERROR] Prometheus connection failed: {error}")
        return []


def collect_metrics():
    timestamp = datetime.now(timezone.utc).isoformat()
    records = []

    for metric_name, config in QUERIES.items():
        source = PROMETHEUS_SOURCES[config["source"]]

        results = query_prometheus(source, config["query"])

        if not results:
            print(f"[WARNING] No data for {metric_name}")
            continue

        for item in results:
            try:
                value = float(item["value"][1])

                records.append({
                    "timestamp": timestamp,
                    "metric": metric_name,
                    "value": value
                })

            except (KeyError, ValueError, TypeError):
                print(f"[WARNING] Invalid value: {metric_name}")

    return records


def save_metrics(records):
    if not records:
        print("No metrics collected.")
        return

    df = pd.DataFrame(records)

    df.to_csv(
        OUTPUT_FILE,
        mode="a",
        header=not os.path.exists(OUTPUT_FILE),
        index=False
    )

    print(df.to_string(index=False))
    print(f"\nSaved to {OUTPUT_FILE}")


def main():
    print("Starting AIOps metrics collection...")

    records = collect_metrics()
    save_metrics(records)

    print("\nCollection completed.")


if __name__ == "__main__":
    main()
