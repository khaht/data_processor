# Data Processor Library

The **Data Processor** is a library designed to process large CSV files by splitting the records into batches and sending them to an API endpoint with concurrency control and retry logic. It is useful for handling bulk user data processing tasks with efficient error handling and logging.

## Features
- Processes CSV files in batches.
- Supports concurrent API requests with a configurable limit.
- Includes retry logic with exponential backoff for failed requests.
- Handles API rate limits with automatic retry after a delay.
- Outputs the results to JSON files (successful users, failed users, wallets, point allocations, transaction audits).

---

## Installation
Ensure you have **Node.js** and **yarn** installed on your system.

```bash
yarn install
```

---

## Using authorization header
### Follow the steps below:

1. Calculate the MD5 hash of the password
2. Concatenate the username and the MD5 hashed password with a colon in between.
3. Encode the concatenated string in Base64.

### For example, if the username is store123 and the password is Pass123:

- MD5 hash of the password `Pass123 - bdc87b9c894da5168059e00ebffb9077`
- Concatenate the username and the MD5 hashed password with a colon in between - `store123:bdc87b9c894da5168059e00ebffb9077`
- Base64 value of the concatenated string - `c3RvcmUxMjM6YmRjODdiOWM4OTRkYTUxNjgwNTllMDBlYmZmYjkwNzc=`
- Final value: `Basic c3RvcmUxMjM6YmRjODdiOWM4OTRkYTUxNjgwNTllMDBlYmZmYjkwNzc=`

## Usage

### Command-Line Interface (CLI)
Run the processor from the command line using the following command:

```bash
yarn start --input <path_to_csv_file> --authorization <api_token> --capillaryHost <api_host>
```

### CLI Options
| Option               | Description                            | Type    | Default | Required |
|----------------------|----------------------------------------|---------|---------|----------|
| `--input`            | Input CSV file path                    | String  | -       | Yes      |
| `--authorization`    | Authorization header                              | String  | -       | Yes      |
| `--capillaryHost`    | Capillary host URL                     | String  | -       | Yes      |
| `--concurrency`      | Number of concurrent requests          | Number  | 5       | No       |
| `--batchSize`        | Number of items per batch              | Number  | 500     | No       |
| `--batchConcurrentLimit` | Number of items to process in parallel | Number  | 100     | No       |
| `--retryAttempts`    | Number of retry attempts               | Number  | 3       | No       |
| `--retryDelay`       | Delay between retry attempts (ms)      | Number  | 1000    | No       |

---

## Example Usage

```bash
yarn start --input ./data/users.csv --authorization "Basic your_api_token" --capillaryHost "https://api.yourdomain.com"
```

---

## Output Files
Upon successful processing, the following output files are generated in the `output` folder:
- `failed_users_logs.json`: Logs of users who failed processing.
- `successful_users_logs.json`: Logs of successfully processed users.
- `wallets.json`: Details of user wallets.
- `point_allocations.json`: Details of point allocations for users.
- `transaction_audits.json`: Transaction audit logs.

---

## Error Handling
The library includes built-in error handling and logs errors to a designated folder in case of request failures. The following output files are generated in the `error_logs` folder

### Example Error Log
```json
{
  "error": "Request failed after all retry attempts",
  "details": "Error details..."
}
```
---

## Notes
- Ensure your CSV file is properly formatted.
- Verify your API credentials before running the processor.
- Adjust concurrency settings based on your API limits.
