
import subprocess
import sys

STEPS = [
    ["python", "metrics_collector.py"],
    ["python", "anomaly_detector.py"],
    ["python", "incident_analyzer.py"]
]

for step in STEPS:
    print(f"\nRunning: {' '.join(step)}")

    result = subprocess.run(step)

    if result.returncode != 0:
        print(f"Failed: {step[1]}")
        sys.exit(result.returncode)

print("\nAIOps workflow completed successfully.")
