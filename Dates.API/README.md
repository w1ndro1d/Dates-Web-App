Back-end for dates app. Exposes the following end-points:

Read all dates logged
GET: api/DateDetails

Read an entry by ID
GET: api/DateDetails/id

Update with ID
PUT: api/DateDetails/id

Create an entry
POST: api/DateDetails

Delete an entry
DELETE: api/DateDetails/id

## Email reminders

Events can send reminders one month before, one week before, one day before, on the event day, or any combination of those choices. The API checks for due reminders every minute while it is running.

Event dates are calendar dates rather than UTC timestamps. The web app records the browser's IANA time zone (for example, `Asia/Kathmandu`) with each event, and the reminder worker evaluates the due date in that time zone. A reminder is sent only on its exact local due date; reminders missed while the API is offline are not sent late.

Configure SMTP through environment variables before starting the API. Gmail requires an app password rather than your normal account password:

```powershell
$env:Email__Smtp__Host = "smtp.gmail.com"
$env:Email__Smtp__Port = "587"
$env:Email__Smtp__Username = "you@example.com"
$env:Email__Smtp__Password = "your-app-password"
$env:Email__Smtp__From = "you@example.com"
$env:Email__Smtp__EnableSsl = "true"
dotnet run --project .\DatesAPI\DatesAPI.csproj --launch-profile https
```

The reminder worker only runs while the API process is running. Restart the API after setting the variables.

## Email verification

New accounts receive a single-use verification link that expires after 24 hours. Login remains disabled until the link is opened. Raw verification tokens are never stored; the database stores only their SHA-256 hashes. Resend requests are limited to one per minute, and existing accounts are treated as verified when the verification migration is applied.

The local URLs default to the standard development ports. Override them in deployed environments:

```powershell
$env:App__ApiBaseUrl = "https://api.example.com"
$env:App__WebBaseUrl = "https://example.com"
```
