#!/usr/bin/env bash
# scripts/autopilot.sh — Autonomous loop driving the PLAN.md roadmap.
# Saves PID to var/run/autopilot.pid, heartbeats to ai/heartbeat.txt, logs to var/log/autopilot.jsonl
set -euo pipefail

INTERVAL=60
MAX_TICKS=0
ONCE=0

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --interval) INTERVAL="$2"; shift ;;
        --max-ticks) MAX_TICKS="$2"; shift ;;
        --once) ONCE=1 ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

# Resolve repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# Setup directories
mkdir -p var/run var/log ai

# Save PID
MY_PID=$$
echo "$MY_PID" > var/run/autopilot.pid

LOG_FILE="var/log/autopilot.jsonl"
HEARTBEAT_FILE="ai/heartbeat.txt"
PLAN_FILE="docs/PLAN.md"

echo "=== Aphrody Autopilot Started (PID: $MY_PID) ==="
echo "Logging to: $LOG_FILE"

if [ "$ONCE" -eq 1 ]; then
    MAX_TICKS=1
fi

tick=0

# Ensure CLI bins are in PATH
if ! command -v claude >/dev/null 2>&1; then
    export PATH="${HOME}/.local/bin:${PATH}"
fi

while true; do
    tick=$((tick + 1))
    if [ "$MAX_TICKS" -gt 0 ] && [ "$tick" -gt "$MAX_TICKS" ]; then
        echo "Reached max ticks ($MAX_TICKS). Stopping."
        break
    fi

    echo -e "\n--- Tick $tick (Interval: ${INTERVAL}s) ---"

    # Find first pending task in PLAN.md
    task="Idle"
    if [ -f "$PLAN_FILE" ]; then
        while IFS= read -r line; do
            trimmed="${line#${line%%[![:space:]]*}}"
            trimmed="${trimmed%${trimmed##*[![:space:]]}}"
            if [[ "$trimmed" == -* ]] && [[ "$trimmed" == *"⏳"* ]]; then
                # Extract task description after ⏳
                task="${line#*⏳}"
                task="${task//\`/}"
                task="${task//$'\r'/}"
                task="${task#${task%%[![:space:]]*}}"
                task="${task%${task##*[![:space:]]}}"
                if [[ "$task" == \]* ]]; then
                    task="${task#]}"
                    task="${task#${task%%[![:space:]]*}}"
                    task="${task%${task##*[![:space:]]}}"
                fi
                break
            fi
        done < "$PLAN_FILE" || true
    fi

    timestamp=$(date -Iseconds)
    echo "Active Task: $task"

    # Write Heartbeat
    echo "$timestamp - Tick $tick - $task" > "$HEARTBEAT_FILE"

    # If no task, sleep and continue
    if [ "$task" = "Idle" ]; then
        echo "No pending tasks in PLAN.md. Resting."
        # Write log entry
        jq -cn \
          --arg ts "$timestamp" \
          --argjson tick "$tick" \
          --arg task "$task" \
          '{ts: $ts, tick: $tick, task: $task, claude: "", gemini: "No tasks found"}' >> "$LOG_FILE"
        
        if [ "$ONCE" -eq 1 ]; then break; fi
        sleep "$INTERVAL"
        continue
    fi

    # Claude Lane (Execution)
    echo "Running Claude Lane..."
    claude_output=""
    prompt="You are an autonomous developer agent. Implement this task: '$task'. Modify files as needed. Do NOT run 'next build', 'bun run build', or 'bun run build:web' locally, as they are known to segfault under Bun (Vercel builds successfully using Node in production). Verify that 'bun run test:all', 'bun run lint', and 'bun run docs:check' pass cleanly. Commit the changes using a French Conventional Commit message. Do not add co-author trailers."
    
    # Run in background with timeout
    (claude --print --permission-mode bypassPermissions "$prompt" < /dev/null) > /tmp/claude_out.log 2>&1 &
    claude_pid=$!
    
    # Timeout logic (10 mins)
    timeout_counter=0
    while kill -0 "$claude_pid" 2>/dev/null; do
        sleep 1
        timeout_counter=$((timeout_counter + 1))
        if [ "$timeout_counter" -ge 600 ]; then
            kill "$claude_pid" 2>/dev/null
            echo "Claude lane timed out."
            claude_output="Err: Timeout after 600s"
            break
        fi
    done

    if [ -z "$claude_output" ]; then
        claude_output=$(cat /tmp/claude_out.log | tr -d '"\r\n' | head -c 800 || echo "")
    fi

    # Gemini Lane (Audit)
    echo "Running Gemini Lane..."
    gemini_output=""
    audit_prompt="Audit the most recent commit in this repository. Verify against the best-stack-2026 guidelines (no GPL licenses, optimal Bun/TypeScript modules, fully cross-platform path handling). Output a strict JSON report summarizing your findings."
    
    # Check if gemini is runnable
    if command -v gemini >/dev/null 2>&1; then
        (gemini --prompt "$audit_prompt") > /tmp/gemini_out.log 2>&1 &
        gemini_pid=$!
        
        timeout_counter=0
        while kill -0 "$gemini_pid" 2>/dev/null; do
            sleep 1
            timeout_counter=$((timeout_counter + 1))
            if [ "$timeout_counter" -ge 60 ]; then # Lower timeout for audit
                kill "$gemini_pid" 2>/dev/null
                echo "Gemini lane timed out."
                gemini_output="Err: Timeout after 60s"
                break
            fi
        done
        
        if [ -z "$gemini_output" ]; then
            gemini_output=$(cat /tmp/gemini_out.log | tr -d '"\r\n' | head -c 800 || echo "")
        fi
    else
        gemini_output="Mock: Gemini binary not found"
    fi

    # Log entry using jq
    jq -cn \
      --arg ts "$timestamp" \
      --argjson tick "$tick" \
      --arg task "$task" \
      --arg claude "$claude_output" \
      --arg gemini "$gemini_output" \
      '{ts: $ts, tick: $tick, task: $task, claude: $claude, gemini: $gemini}' >> "$LOG_FILE"

    # Mark the task completed in PLAN.md using python3
    if [ -f "$PLAN_FILE" ]; then
        python3 -c "
import sys
content = open('$PLAN_FILE', 'r', encoding='utf-8').read()
target = '⏳'
replacement = '✅'
if target in content:
    parts = content.split(target, 1)
    new_content = parts[0] + replacement + parts[1]
    open('$PLAN_FILE', 'w', encoding='utf-8').write(new_content)
    print('Marked task as completed.')
"
    fi

    # Update docs index automatically
    bun run docs >/dev/null 2>&1 || true

    if [ "$ONCE" -eq 1 ]; then break; fi
    sleep "$INTERVAL"
done
