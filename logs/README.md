# MM Sync Logs

This directory contains log files for the MM sync operations.

## Log Files

- `mm-sync-YYYY-MM-DD.log` - Daily log files containing detailed sync operations
- Each log entry is in JSON format with timestamp, level, message, and optional data

## Log Levels

- `INFO` - General information about sync progress
- `WARN` - Warnings that don't stop the sync
- `ERROR` - Errors that may affect individual operations
- `SUCCESS` - Successful operations and completions

## Monitoring

You can monitor the sync in real-time using:

```bash
# Watch the latest log file
tail -f logs/mm-sync-$(date +%Y-%m-%d).log

# Filter for errors only
tail -f logs/mm-sync-$(date +%Y-%m-%d).log | grep '"level":"ERROR"'

# Pretty print JSON logs
tail -f logs/mm-sync-$(date +%Y-%m-%d).log | jq '.'
```

## Log Rotation

Log files are created daily. Old log files should be archived or deleted as needed to manage disk space.