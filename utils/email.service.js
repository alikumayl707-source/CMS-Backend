    const { getGraphToken } = require("./orgSync");

    async function sendClaimSubmittedEmail({
    to,
    employeeName,
    claimNumber,
    claimType,
    amount
    }) {

    const token = await getGraphToken();

    const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${process.env.MAIL_SENDER}/sendMail`,
        {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message: {
            subject: `Claim Submitted - ${claimNumber}`,
            body: {
                contentType: "HTML",
                content: `
                <div style="font-family:Segoe UI,Arial,sans-serif">

                    <h2>Claim Submitted Successfully</h2>

                    <p>Dear ${employeeName},</p>

                    <p>Your claim has been submitted successfully.</p>

                    <table style="border-collapse:collapse">
                    <tr>
                        <td><b>Claim Number</b></td>
                        <td>${claimNumber}</td>
                    </tr>

                    <tr>
                        <td><b>Claim Type</b></td>
                        <td>${claimType}</td>
                    </tr>

                    <tr>
                        <td><b>Amount</b></td>
                        <td>${amount}</td>
                    </tr>

                    <tr>
                        <td><b>Status</b></td>
                        <td>PENDING_REVIEW</td>
                    </tr>
                    </table>

                    <br>

                    <p>
                    You will receive further notifications as the claim
                    progresses through the approval workflow.
                    </p>

                    <p>
                    Regards,<br>
                    Claims Management System
                    </p>

                </div>
                `
            },
            toRecipients: [
                {
                emailAddress: {
                    address: to
                }
                }
            ]
            },
            saveToSentItems: true
        })
        }
    );

    if (!response.ok) {

        const error =
        await response.text();

        throw new Error(
        `Email send failed: ${error}`
        );
    }
    }
    async function sendApprovalEmail({
  to,
  approverName,
  claimantName,
  claimNumber,
  claimType,
  amount,
  claimId,
  documents = []
}) {

  const token = await getGraphToken();

  const approvalUrl =
    `${process.env.FRONTEND_URL}/claims/${claimId}/approve`;

  const documentLinks =
    documents.length
      ? documents.map(doc => `
          <li>${doc.originalName}</li>
        `).join("")
      : "<li>No documents attached</li>";

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${process.env.MAIL_SENDER}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: {
          subject: `Approval Required - ${claimNumber}`,
          body: {
            contentType: "HTML",
            content: `
              <div style="font-family:Segoe UI,Arial,sans-serif">

                <h2>Claim Approval Required</h2>

                <p>Dear ${approverName},</p>

                <p>
                  A claim requires your approval.
                </p>

                <table style="border-collapse:collapse;">
                  <tr>
                    <td><b>Claim No</b></td>
                    <td style="padding-left:15px;">
                      ${claimNumber}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Claimant Person</strong></td>
                    <td style="padding-left:15px;">${claimantName}</td>
                  </tr>
                  <tr>
                    <td><b>Claim Type</b></td>
                    <td style="padding-left:15px;">
                      ${claimType}
                    </td>
                  </tr>

                  <tr>
                    <td><b>Amount</b></td>
                    <td style="padding-left:15px;">
                      ${amount}
                    </td>
                  </tr>
                </table>

                <br>

                <h3>Claim Documents</h3>

                <ul style="text-decoration:none;">
                    <a href="${approvalUrl}"style="text-decoration:none;">${documentLinks}</a>
                </ul>

                <p>
                  Documents can be viewed and downloaded after opening the claim.
                </p>

                <br>
                <a href="
                ${approvalUrl}"
                  style="
                    background:#2e5395;
                    color:#fff;
                    padding:24px 35px;
                    text-decoration:none;
                    border-radius:6px;
                    display:inline-block;
                    font-weight:600;
                  "
                >
                  Review Claim
                </a>

                <br><br>

                <p>
                  Please review and take action.
                </p>

              </div>
            `
          },
          toRecipients: [
            {
              emailAddress: {
                address: to
              }
            }
          ]
        },
        saveToSentItems: true
      })
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function sendReminderEmail({
  to,
  approverName,
  claimNumber,
  claimId,
  hoursPending
}) {

  const token = await getGraphToken();

  const approvalUrl = `${process.env.FRONTEND_URL}/claims/${claimId}/approve`;

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${process.env.MAIL_SENDER}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: {
          subject: `Reminder: Approval Pending - ${claimNumber}`,
          body: {
            contentType: "HTML",
            content: `
              <div style="font-family:Segoe UI,Arial,sans-serif">
                <h2>Reminder: Claim Approval Pending</h2>
                <p>Dear ${approverName},</p>
                <p>
                  Claim <b>${claimNumber}</b> has been awaiting your approval for
                  approximately <b>${hoursPending} hours</b>.
                </p>
                <br>
                <a href="${approvalUrl}"
                  style="background:#c98a2b;color:#fff;padding:14px 24px;
                  text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">
                  Review Claim
                </a>
                <br><br>
                <p>Please review at your earliest convenience.</p>
              </div>
            `
          },
          toRecipients: [{ emailAddress: { address: to } }]
        },
        saveToSentItems: true
      })
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function sendEscalationEmail({
  to,
  approverName,
  claimNumber,
  claimId,
  hoursPending
}) {

  const token = await getGraphToken();

  const approvalUrl = `${process.env.FRONTEND_URL}/claims/${claimId}/approve`;

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${process.env.MAIL_SENDER}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: {
          subject: `Escalated to You - ${claimNumber}`,
          body: {
            contentType: "HTML",
            content: `
              <div style="font-family:Segoe UI,Arial,sans-serif">
                <h2>Claim Escalated to You</h2>
                <p>Dear ${approverName},</p>
                <p>
                  Claim <b>${claimNumber}</b> was not actioned within ${hoursPending} hours
                  by the originally assigned approver and has been escalated to you.
                </p>
                <br>
                <a href="${approvalUrl}"
                  style="background:#c0392b;color:#fff;padding:14px 24px;
                  text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">
                  Review Claim Now
                </a>
                <br><br>
                <p>Please action this claim promptly.</p>
              </div>
            `
          },
          toRecipients: [{ emailAddress: { address: to } }]
        },
        saveToSentItems: true
      })
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function sendClaimantProgressEmail({
  to,
  employeeName,
  claimNumber,
  claimType,
  amount,
  stageDescription,
  hoursPending
}) {

  const token = await getGraphToken();

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${process.env.MAIL_SENDER}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: {
          subject: `Update on Your Claim - ${claimNumber}`,
          body: {
            contentType: "HTML",
            content: `
              <div style="font-family:Segoe UI,Arial,sans-serif">
                <h2>Your Claim Is Still Being Reviewed</h2>
                <p>Dear ${employeeName},</p>
                <p>
                  Your claim is taking a bit longer than usual to process. Here is the current status:
                </p>
                <table style="border-collapse:collapse">
                  <tr><td><b>Claim Number</b></td><td style="padding-left:15px;">${claimNumber}</td></tr>
                  <tr><td><b>Claim Type</b></td><td style="padding-left:15px;">${claimType}</td></tr>
                  <tr><td><b>Amount</b></td><td style="padding-left:15px;">${amount}</td></tr>
                  <tr><td><b>Current Status</b></td><td style="padding-left:15px;">${stageDescription}</td></tr>
                  <tr><td><b>Time Pending</b></td><td style="padding-left:15px;">~${hoursPending} hours</td></tr>
                </table>
                <br>
                <p>
                  We have sent a reminder to the relevant approver. You do not need to take any action —
                  we will notify you as soon as your claim progresses.
                </p>
                <br>
                <p>Regards,<br>Claims Management System</p>
              </div>
            `
          },
          toRecipients: [{ emailAddress: { address: to } }]
        },
        saveToSentItems: true
      })
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }
}
async function sendDigestEmail({ to, approverName, items }) {

  const token = await getGraphToken();

  const rows = items.map(item => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${item.claimNumber}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${item.stageLabel}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">~${item.hoursPending} hrs</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">
        <a href="${process.env.FRONTEND_URL}/claims/${item.claimId}/approve">Review</a>
      </td>
    </tr>
  `).join("");

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${process.env.MAIL_SENDER}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: {
          subject: `Daily Reminder: ${items.length} Claim(s) Awaiting Your Approval`,
          body: {
            contentType: "HTML",
            content: `
              <div style="font-family:Segoe UI,Arial,sans-serif">
                <h2>Claims Awaiting Your Approval</h2>
                <p>Dear ${approverName},</p>
                <p>You have <b>${items.length}</b> claim(s) that have been pending for 24+ hours:</p>

                <table style="border-collapse:collapse;width:100%;max-width:600px;">
                  <thead>
                    <tr style="background:#1F4E78;color:#fff;">
                      <th style="padding:8px 12px;text-align:left;">Claim</th>
                      <th style="padding:8px 12px;text-align:left;">Stage</th>
                      <th style="padding:8px 12px;text-align:left;">Pending</th>
                      <th style="padding:8px 12px;text-align:left;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows}
                  </tbody>
                </table>

                <br>
                <p>This is a single daily summary — you won't receive a separate email per claim.</p>
              </div>
            `
          },
          toRecipients: [{ emailAddress: { address: to } }]
        },
        saveToSentItems: true
      })
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

module.exports = {
  sendClaimSubmittedEmail,
  sendApprovalEmail,
  sendReminderEmail,          
  sendEscalationEmail,
  sendClaimantProgressEmail,
  sendDigestEmail   
};
