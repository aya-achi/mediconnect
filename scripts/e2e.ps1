# MediConnect end-to-end test.
# Prerequisites: docker compose up -d --build (from docker/), GROQ_API_KEY set,
# test-data/sample.pdf present. Run: pwsh scripts/e2e.ps1
param(
    [string]$BaseUrl = "http://127.0.0.1:5195",
    [string]$AdminEmail = "admin@example.com",
    [string]$AdminPassword = "Admin12345!",
    [string]$DoctorEmail = "sarah.mitchell@mediconnect.com",
    [string]$DoctorPassword = "Password123!",
    [string]$SamplePdf = "test-data/sample.pdf"
)

$ErrorActionPreference = "Stop"
$script:Pass = 0
$script:Fail = 0
$script:createdUsers = @()

function Track-User($u) {
    if (-not $u -or -not $u.id) { return }
    $script:createdUsers = @($script:createdUsers | Where-Object { $_.id -ne $u.id }) + $u
}

function Step([string]$name, [scriptblock]$body) {
    Write-Host "`n=== $name ===" -ForegroundColor Cyan
    try {
        & $body
        $script:Pass++
        Write-Host "PASS: $name" -ForegroundColor Green
    } catch {
        $script:Fail++
        Write-Host "FAIL: $name -> $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

function Invoke-Api {
    param(
        [string]$Method = "GET",
        [string]$Path,
        [string]$Token,
        [object]$Body
    )
    $headers = @{}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $params = @{
        Method      = $Method
        Uri         = "$BaseUrl$Path"
        Headers     = $headers
        ContentType = "application/json"
    }
    if ($null -ne $Body) { $params["Body"] = ($Body | ConvertTo-Json -Depth 6) }
    try {
        Invoke-RestMethod @params
    } catch {
        $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { "?" }
        throw "HTTP $status $Method $Path"
    }
}

function Invoke-ApiStatus {
    # Returns HTTP status code via curl.exe; works on PS5.1 and PS7
    param(
        [string]$Method = "GET",
        [string]$Path,
        [string]$Token,
        [object]$Body
    )
    $args = @("-s", "-o", "NUL", "-w", "%{http_code}", "-X", $Method, "$BaseUrl$Path")
    $tmpFile = $null
    if ($Token) { $args += @("-H", "Authorization: Bearer $Token") }
    if ($null -ne $Body) {
        $tmpFile = [System.IO.Path]::GetTempFileName()
        ($Body | ConvertTo-Json -Depth 6 -Compress) | Set-Content -Path $tmpFile -NoNewline -Encoding ascii
        $args += @("-H", "Content-Type: application/json", "-d", "@$tmpFile")
    }
    try {
        $code = & curl.exe @args 2>$null
    } finally {
        if ($tmpFile) { Remove-Item $tmpFile -ErrorAction SilentlyContinue }
    }
    return [int]$code
}

function Login([string]$email, [string]$password) {
    Invoke-Api -Method POST -Path "/api/Auth/login" -Body @{
        email = $email; password = $password
    }
}

function Register([string]$fullName, [string]$email, [string]$password, [int]$role) {
    Invoke-Api -Method POST -Path "/api/Auth/register" -Body @{
        fullName = $fullName; email = $email; password = $password; role = $role
    }
}

function BookAppointment([string]$token, [string]$patientId, [string]$doctorProfileId, [string]$reason, [int]$daysAhead = 2) {
    Invoke-Api -Method POST -Path "/api/Appointments" -Token $token -Body @{
        appointmentDate = (Get-Date).AddDays($daysAhead).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        reason          = $reason
        doctorProfileId = $doctorProfileId
        patientId       = $patientId
    }
}

$stamp = Get-Date -Format "HHmmss"
$patientAEmail = "e2e-a-$stamp@example.com"
$patientBEmail = "e2e-b-$stamp@example.com"
$applicantEmail = "e2e-doc-$stamp@example.com"
$deactivatedEmail = "e2e-off-$stamp@example.com"
$patientPassword = "PatientPass123!"
$applicantPassword = "DoctorPass123!"

# 0. Wait for services to be ready
Write-Host "`n=== 0. Waiting for services ===" -ForegroundColor Cyan
$deadline = (Get-Date).AddSeconds(180)
$monolithReady = $false
$aiReady = $false
while ((Get-Date) -lt $deadline -and -not ($monolithReady -and $aiReady)) {
    if (-not $monolithReady) {
        $code = & curl.exe -s -o NUL -w "%{http_code}" "$BaseUrl/api/DoctorProfiles" 2>$null
        if ($code -match "200|401|403") { $monolithReady = $true }
    }
    if (-not $aiReady) {
        $code = & curl.exe -s -o NUL -w "%{http_code}" "http://127.0.0.1:5198/" 2>$null
        if ($code -match "200") { $aiReady = $true }
    }
    if (-not ($monolithReady -and $aiReady)) { Start-Sleep -Seconds 3 }
}
if (-not $monolithReady) { throw "monolith did not become ready within 180s" }
if (-not $aiReady) { throw "ai-service did not become ready within 180s" }
Write-Host "  monolith ready, ai-service ready"

try {
# 1. Admin login
Step "1. Admin login + stats" {
    $script:admin = Login $AdminEmail $AdminPassword
    if (-not $script:admin.token) { throw "no token returned" }
    Write-Host "  admin: $($script:admin.email) role=$($script:admin.role)"

    $stats = Invoke-Api -Path "/api/Stats" -Token $script:admin.token
    if ($null -eq $stats.totalPatients -or $null -eq $stats.totalDoctors) { throw "stats fields missing" }
    Write-Host "  stats: patients=$($stats.totalPatients) doctors=$($stats.totalDoctors) appts=$($stats.totalAppointments) today=$($stats.appointmentsToday) pendingApps=$($stats.pendingApplications)"
}

# 2. Register patient A + B + a user to deactivate later
Step "2. Register users" {
    $script:patientA = Register "E2E Patient A" $patientAEmail $patientPassword 0
    $script:patientB = Register "E2E Patient B" $patientBEmail $patientPassword 0
    $script:offUser = Register "E2E Off User" $deactivatedEmail $patientPassword 0
    Track-User $script:patientA
    Track-User $script:patientB
    Track-User $script:offUser
    Write-Host "  A: $($script:patientA.email)  B: $($script:patientB.email)"
}

# 3. Patient flow: login, list doctors (approved only), open profile, book, list, cancel, message
Step "3. Patient flow: doctors -> profile -> book -> cancel -> message" {
    $script:patientA = Login $patientAEmail $patientPassword
    $script:patientB = Login $patientBEmail $patientPassword
    Track-User $script:patientA
    Track-User $script:patientB

    $doctors = Invoke-Api -Path "/api/DoctorProfiles" -Token $script:patientA.token
    if (@($doctors).Count -lt 1) { throw "no approved doctors listed" }
    foreach ($d in $doctors) {
        if (-not $d.isApproved) { throw "unapproved doctor $($d.fullName) visible to patient" }
    }
    $script:profile = $doctors | Select-Object -First 1
    $doctorProfileId = $script:profile.id
    $doctorUserId = $script:profile.userId
    Write-Host "  $(@($doctors).Count) approved doctor(s); using $($script:profile.fullName)"

    # Open profile (same call the detail page makes)
    $one = Invoke-Api -Path "/api/DoctorProfiles/$doctorProfileId" -Token $script:patientA.token
    if ($one.id -ne $doctorProfileId) { throw "profile lookup failed" }
    Write-Host "  profile opened: $($one.fullName)"

    # Book appointment #1 (will be confirmed + completed by doctor)
    $appt1 = BookAppointment $script:patientA.token $script:patientA.id $doctorProfileId "E2E checkup" 2
    Write-Host "  appointment1 $($appt1.id) status=$($appt1.status)"

    # Book appointment #2 (patient will cancel)
    $appt2 = BookAppointment $script:patientA.token $script:patientA.id $doctorProfileId "E2E cancel-me" 3
    Write-Host "  appointment2 $($appt2.id) status=$($appt2.status)"

    # List appointments as patient
    $appts = Invoke-Api -Path "/api/Appointments/patient/$($script:patientA.id)" -Token $script:patientA.token
    if (@($appts).Count -lt 2) { throw "expected >=2 appointments, got $(@($appts).Count)" }
    Write-Host "  patient sees $(@($appts).Count) appointment(s)"

    # Cancel appointment #2
    $cancelled = Invoke-Api -Method PUT -Path "/api/Appointments/$($appt2.id)/cancel" -Token $script:patientA.token
    if ($cancelled.status -ne 2) { throw "cancel failed, status=$($cancelled.status)" }
    Write-Host "  appointment2 cancelled"
}

# 4. Doctor flow: login, see appointments via /doctor/me, confirm, complete, conversations, reply
Step "4. Doctor flow: appointments, confirm, complete, messages" {
    $script:doctor = Login $DoctorEmail $DoctorPassword

    $docAppts = Invoke-Api -Path "/api/Appointments/doctor/me" -Token $script:doctor.token
    $appt1 = $null
    foreach ($a in $docAppts) {
        if ($a.reason -eq "E2E checkup" -and $a.patientId -eq $script:patientA.id) { $appt1 = $a; break }
    }
    if (-not $appt1) { throw "doctor cannot see patient A's appointment via /doctor/me" }
    Write-Host "  doctor sees $(@($docAppts).Count) appointment(s); found E2E checkup"

    $confirmed = Invoke-Api -Method PUT -Path "/api/Appointments/$($appt1.id)/confirm" -Token $script:doctor.token
    if ($confirmed.status -ne 1) { throw "appointment not confirmed (status=$($confirmed.status))" }
    Write-Host "  appointment confirmed (confirm also creates the conversation)"

    $convs = Invoke-Api -Path "/api/Conversations" -Token $script:doctor.token
    $script:conversationId = $null
    foreach ($c in $convs) {
        if ($c.patientId -eq $script:patientA.id) { $script:conversationId = $c.id; break }
    }
    if (-not $script:conversationId) { throw "doctor has no conversation with patient A" }
    Write-Host "  conversation $($script:conversationId)"

    Invoke-Api -Method POST -Path "/api/Conversations/$($script:conversationId)/messages" -Token $script:doctor.token -Body @{
        content = "Hello! Your appointment is confirmed."
    } | Out-Null
    Invoke-Api -Method POST -Path "/api/Conversations/$($script:conversationId)/messages" -Token $script:patientA.token -Body @{
        content = "Thank you doctor!"
    } | Out-Null
    $msgs = Invoke-Api -Path "/api/Conversations/$($script:conversationId)/messages" -Token $script:doctor.token
    if (@($msgs).Count -lt 2) { throw "expected >=2 messages, got $(@($msgs).Count)" }
    Write-Host "  messages exchanged: $(@($msgs).Count)"

    $completed = Invoke-Api -Method PUT -Path "/api/Appointments/$($appt1.id)/complete" -Token $script:doctor.token
    if ($completed.status -ne 3) { throw "complete failed, status=$($completed.status)" }
    Write-Host "  appointment completed"
}

# 5. Doctor applicant flow: apply -> hidden -> admin approves -> visible + bookable
Step "5. Doctor applicant approval flow" {
    $script:applicant = Register "E2E Applicant Doc" $applicantEmail $applicantPassword 1
    Track-User $script:applicant
    Invoke-Api -Method POST -Path "/api/DoctorProfiles" -Token $script:applicant.token -Body @{
        fullName = "E2E Applicant Doc"; specialty = "Cardiology"; bio = "e2e"
        consultationFee = 60; yearsOfExperience = 5; city = "Paris"
    } | Out-Null
    $application = Invoke-Api -Method POST -Path "/api/DoctorApplications" -Token $script:applicant.token -Body @{
        userId = $script:applicant.id; fullName = "E2E Applicant Doc"; email = $applicantEmail
        specialty = "Cardiology"; licenseNumber = "LIC-1"; city = "Paris"
        yearsOfExperience = 5; bio = "e2e"; documentCount = 0
    }
    Write-Host "  application $($application.id) status=$($application.status)"

    # Not visible to patients
    $docList = Invoke-Api -Path "/api/DoctorProfiles" -Token $script:patientA.token
    $visible = @($docList | Where-Object { $_.email -eq $applicantEmail -or $_.user.email -eq $applicantEmail })
    if ($visible.Count -gt 0) { throw "pending applicant visible to patient" }
    Write-Host "  pending applicant hidden from patient list"

    # Not bookable
    $appProfile = Invoke-Api -Path "/api/DoctorProfiles/user/$($script:applicant.id)" -Token $script:admin.token
    $bookStatus = Invoke-ApiStatus -Method POST -Path "/api/Appointments" -Token $script:patientA.token -Body @{
        appointmentDate = (Get-Date).AddDays(4).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        reason = "should fail"; doctorProfileId = $appProfile.id; patientId = $script:patientA.id
    }
    if ($bookStatus -ne 400) { throw "booking unapproved doctor returned HTTP $bookStatus (expected 400)" }
    Write-Host "  booking unapproved doctor -> HTTP 400"

    # Admin sees pending application and approves
    $apps = Invoke-Api -Path "/api/DoctorApplications?status=pending" -Token $script:admin.token
    $mine = @($apps | Where-Object { $_.id -eq $application.id })
    if ($mine.Count -eq 0) { throw "admin cannot see pending application" }
    Invoke-Api -Method PUT -Path "/api/DoctorApplications/$($application.id)/approve" -Token $script:admin.token | Out-Null
    Write-Host "  admin approved application"

    # Now visible + bookable
    $docList2 = Invoke-Api -Path "/api/DoctorProfiles" -Token $script:patientA.token
    $visible2 = @($docList2 | Where-Object { $_.user.email -eq $applicantEmail })
    if ($visible2.Count -eq 0) { throw "approved doctor still hidden from patient" }
    $appt3 = BookAppointment $script:patientA.token $script:patientA.id $appProfile.id "post-approval" 4
    Write-Host "  approved doctor visible and bookable (appt $($appt3.id))"
}

# 6. Upload document
Step "6. Upload sample.pdf" {
    $pdfPath = Resolve-Path $SamplePdf
    $uploadOutput = & curl.exe -s -X POST "$BaseUrl/api/Ai/documents" `
        -H "Authorization: Bearer $($script:patientA.token)" `
        -F "file=@$($pdfPath.Path);type=application/pdf" 2>&1
    $upload = $uploadOutput | ConvertFrom-Json
    if (-not $upload.success) { throw "upload failed: $uploadOutput" }
    $script:docId = $upload.document.id
    Write-Host "  uploaded '$($upload.document.fileName)' -> $($script:docId) ($($upload.document.chunkCount) chunks)"
}

# 7. RAG questions: 3 on-topic + 1 off-topic
Step "7. RAG questions + sources + relevance threshold" {
    $questions = @(
        @{ q = "According to the uploaded document, what are the common symptoms of type 2 diabetes?"; onTopic = $true },
        @{ q = "What medication does the document mention for managing type 2 diabetes?"; onTopic = $true },
        @{ q = "How can type 2 diabetes be managed according to the document?"; onTopic = $true },
        @{ q = "What is the capital of France?"; onTopic = $false }
    )
    $script:ragResults = @()
    foreach ($item in $questions) {
        $resp = Invoke-Api -Method POST -Path "/api/Ai/chat" -Token $script:patientA.token -Body @{
            query       = $item.q
            chatHistory = @()
        }
        Write-Host "`n  Q: $($item.q)"
        Write-Host "  A: $($resp.answer)"
        if ($resp.sources) {
            foreach ($s in $resp.sources) {
                $snip = if ($s.snippet) { $s.snippet.Substring(0, [Math]::Min(80, $s.snippet.Length)) } else { "" }
                Write-Host "     [source] $($s.title) p.$($s.page) - $snip..."
            }
        }
        $script:ragResults += [pscustomobject]@{ Question = $item.q; OnTopic = $item.onTopic; Answer = $resp.answer; Sources = @($resp.sources) }
    }
    foreach ($r in $script:ragResults) {
        if ($r.OnTopic) {
            if ($r.Sources.Count -eq 0) { throw "on-topic question returned no sources: $($r.Question)" }
        } else {
            if ($r.Sources.Count -ne 0) { throw "off-topic question returned sources (expected empty): $($r.Sources.Count)" }
            if ($r.Answer -notmatch "(?i)not enough information|insufficient|could not find") {
                throw "off-topic question did not return insufficient-context message: $($r.Answer)"
            }
        }
    }
}

# 8. Admin: users list, reject flow, deactivate user -> login refused
Step "8. Admin user management" {
    $users = Invoke-Api -Path "/api/Users" -Token $script:admin.token
    if (@($users).Count -lt 3) { throw "admin user list too small" }
    Write-Host "  admin sees $(@($users).Count) users"

    # Reject a second applicant to exercise reject path
    $script:rej = Register "E2E Reject Doc" "e2e-rej-$stamp@example.com" $applicantPassword 1
    Track-User $script:rej
    Invoke-Api -Method POST -Path "/api/DoctorProfiles" -Token $script:rej.token -Body @{
        fullName = "E2E Reject Doc"; specialty = "ENT"; bio = "e2e"
        consultationFee = 50; yearsOfExperience = 2; city = "Lyon"
    } | Out-Null
    $rejApp = Invoke-Api -Method POST -Path "/api/DoctorApplications" -Token $script:rej.token -Body @{
        userId = $script:rej.id; fullName = "E2E Reject Doc"; email = "e2e-rej-$stamp@example.com"
        specialty = "ENT"; licenseNumber = "LIC-2"; city = "Lyon"
        yearsOfExperience = 2; bio = "e2e"; documentCount = 0
    }
    Invoke-Api -Method PUT -Path "/api/DoctorApplications/$($rejApp.id)/reject" -Token $script:admin.token | Out-Null
    $docList3 = Invoke-Api -Path "/api/DoctorProfiles" -Token $script:patientA.token
    $rejVisible = @($docList3 | Where-Object { $_.user.email -eq "e2e-rej-$stamp@example.com" })
    if ($rejVisible.Count -gt 0) { throw "rejected doctor visible to patient" }
    Write-Host "  rejected applicant hidden from patient list"

    # Deactivate off-user -> login refused
    Invoke-Api -Method PUT -Path "/api/Users/$($script:offUser.id)" -Token $script:admin.token -Body @{
        fullName = "E2E Off User"; email = $deactivatedEmail; isActive = $false
    } | Out-Null
    $status = Invoke-ApiStatus -Method POST -Path "/api/Auth/login" -Body @{
        email = $deactivatedEmail; password = $patientPassword
    }
    if ($status -ne 401 -and $status -ne 403) { throw "deactivated user login returned HTTP $status" }
    Write-Host "  deactivated user login -> HTTP $status (refused)"
}

# 9. Security checks
Step "9. Security checks" {
    # Patient -> admin endpoints = 403
    $s1 = Invoke-ApiStatus -Path "/api/Stats" -Token $script:patientA.token
    if ($s1 -ne 403) { throw "patient /Stats -> HTTP $s1 (expected 403)" }
    $s2 = Invoke-ApiStatus -Path "/api/Users" -Token $script:patientA.token
    if ($s2 -ne 403) { throw "patient /Users -> HTTP $s2 (expected 403)" }
    Write-Host "  patient -> admin endpoints: 403"

    # No token -> 401
    $s3 = Invoke-ApiStatus -Path "/api/Conversations"
    if ($s3 -ne 401) { throw "no-token /Conversations -> HTTP $s3 (expected 401)" }
    Write-Host "  no token -> 401"

    # Patient B cannot access A's appointments / conversations / documents
    $s4 = Invoke-ApiStatus -Path "/api/Appointments/patient/$($script:patientA.id)" -Token $script:patientB.token
    if ($s4 -ne 403) { throw "B -> A appointments -> HTTP $s4 (expected 403)" }

    $s5 = Invoke-ApiStatus -Path "/api/Conversations/$($script:conversationId)/messages" -Token $script:patientB.token
    if ($s5 -ne 403) { throw "B -> A conversation -> HTTP $s5 (expected 403)" }

    $s6 = Invoke-ApiStatus -Method DELETE -Path "/api/Ai/documents/$($script:docId)" -Token $script:patientB.token
    if ($s6 -eq 200 -or $s6 -eq 204) { throw "B deleted A's document" }
    Write-Host "  B -> A appointments:$s4 conversation:$s5 doc-delete:$s6 (all refused)"

    # passwordHash must never appear in responses
    $loginJson = (Login $patientAEmail $patientPassword) | ConvertTo-Json -Depth 6
    if ($loginJson -match "passwordHash|PasswordHash") { throw "passwordHash leaked in login response" }
    $usersJson = (Invoke-Api -Path "/api/Users" -Token $script:admin.token) | ConvertTo-Json -Depth 6
    if ($usersJson -match "passwordHash|PasswordHash") { throw "passwordHash leaked in users response" }
    Write-Host "  no passwordHash in responses"
}

# 10. Patient document list + delete own doc
Step "10. Patient document list + delete" {
    $docs = Invoke-Api -Path "/api/Ai/documents" -Token $script:patientA.token
    if (@($docs).Count -lt 1) { throw "patient A document list empty" }
    Write-Host "  patient A documents: $(@($docs | ForEach-Object { $_.fileName }) -join ', ')"

    Invoke-Api -Method DELETE -Path "/api/Ai/documents/$($script:docId)" -Token $script:patientA.token | Out-Null
    $docsAfter = Invoke-Api -Path "/api/Ai/documents" -Token $script:patientA.token
    if (@($docsAfter | Where-Object { $_.id -eq $script:docId }).Count -ne 0) { throw "document not deleted" }
    Write-Host "  document deleted by owner"
}

# 11. Persistence across restart
Step "11. Persistence across docker compose restart" {
    docker compose -f docker/docker-compose.yml restart | Out-Null
    $deadline = (Get-Date).AddSeconds(180)
    $docs = $null
    $ok = $false
    while ((Get-Date) -lt $deadline -and -not $ok) {
        try {
            $docs = Invoke-Api -Path "/api/Ai/documents" -Token $script:patientA.token
            $appts = Invoke-Api -Path "/api/Appointments/patient/$($script:patientA.id)" -Token $script:patientA.token
            $ok = $true
        } catch {
            Start-Sleep -Seconds 5
        }
    }
    if (-not $ok) { throw "services did not become ready after restart" }
    $docList = Invoke-Api -Path "/api/DoctorProfiles" -Token $script:patientA.token
    if (@($docList).Count -lt 3) { throw "seeded doctors missing after restart" }
    Write-Host "  data persists: $(@($appts).Count) appointments, $(@($docList).Count) doctors visible"
}

} finally {
    Write-Host "`n=== Cleanup: removing test data ===" -ForegroundColor Cyan
    # Delete AI documents owned by test users first (best effort)
    foreach ($u in $script:createdUsers) {
        if (-not $u.token) { continue }
        try {
            $docs = Invoke-Api -Path "/api/Ai/documents" -Token $u.token
            foreach ($d in @($docs)) {
                Invoke-ApiStatus -Method DELETE -Path "/api/Ai/documents/$($d.id)" -Token $u.token | Out-Null
            }
        } catch { }
    }
    if ($script:admin -and $script:admin.token) {
        foreach ($u in $script:createdUsers) {
            try {
                $code = Invoke-ApiStatus -Method DELETE -Path "/api/Users/$($u.id)" -Token $script:admin.token
                Write-Host "  deleted $($u.email) -> HTTP $code"
            } catch {
                Write-Host "  delete $($u.email) failed: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "  admin token unavailable; test users NOT deleted" -ForegroundColor Yellow
    }
}

Write-Host "`n===================================" -ForegroundColor Cyan
Write-Host "E2E RESULT: $script:Pass passed, $script:Fail failed" -ForegroundColor $(if ($script:Fail -eq 0) { "Green" } else { "Red" })
if ($script:Fail -gt 0) { exit 1 }
