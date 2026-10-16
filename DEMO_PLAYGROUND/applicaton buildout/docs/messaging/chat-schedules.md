# Schedule tools in chat

In a signed-in direct or group conversation, the **＋** beside the message field
opens **Share schedule** and **Find time together**. These tools are deliberately
unavailable in public chat.

## Share schedule

Choose a day, a date in a specific Monday–Sunday week, or one of your saved terms.
Sharing creates a snapshot of timed classes and individual events, including titles,
times and location text. Private event notes are excluded. Async classes have no time
blocks and are not included. Review the disclosure before selecting **Share with this
chat**. The card lets recipients browse dates without leaving the conversation.

Snapshots do not change when the original schedule changes. They are available to
current and future chat members, like other chat history. Deleting the shared message
removes its attachment. As with ordinary messages, deletion cannot retract copies a
recipient has already saved.

## Find time together

Create an invitation for a day, week or term. No one, including its creator, is opted
in automatically. **Opt in** permits current participating chat members to compare
free time within the invitation's displayed date range. After opting in, select at
least two opted-in members, a target day/week or the entire invitation, and daily
hours. The default is 08:00–22:00 in **America/Detroit**.

The server intersects availability across all selected members and returns free
windows lasting at least 30 minutes. A longer window can fit multiple half-hour
sessions; this feature does not reserve a time or create calendar events. Each viewer
can independently interact with the same invitation card; their selection and results
are not posted as a separate message. No class titles, locations, notes, or individual
busy calendars are sent in the availability response.

Results use saved classes and individual events. Every selected participant must
have a schedule term covering the requested dates; missing terms mean unknown,
not completely free. Unrecorded commitments and asynchronous course workloads are
not accounted for. Re-run the comparison after schedule changes.

Withdrawal revokes future comparisons immediately. Leaving/removal from a group
revokes consent, including if later re-added. Membership and consent are checked
server-side on every query. SSE consent updates invalidate displayed results;
results are also hidden when membership changes. Already viewed information cannot
be retroactively erased. Deleted invitations cannot be joined or queried.

## Edit and delete

Right-click an owned message on web, long-press on mobile, or use its **•••** button.
Editing changes message text/caption; it does not silently replace a shared snapshot
or widen an invitation's consent range. Delete requires confirmation and leaves a
“Message deleted” placeholder, removing text, attachments and associated consent.
System messages cannot be edited/deleted. Anonymous public messages have no account
owner. Stale concurrent changes return an actionable conflict instead of overwriting
newer text. SSE and history carry message versions to prevent stale history reads
from undoing newer edits.

## Deployment and verification

Migration `a1e7d54b986f` adds message attachment/version/edited fields and the
`chat_participation` table. Back up and deploy with:

```sh
./scripts/deploy-ec2.sh --migrate
```

The migration was applied successfully to a disposable PostgreSQL database.
Backend tests cover ownership, stale versions, private snapshots, opt-in/withdrawal,
range restrictions, missing coverage, busy overlaps and half-hour minimums. Browser
QA uses a disposable SQLite app, never real chat accounts. It verified the plus menu,
term sharing/viewing, selecting participants/day, common free windows, withdrawing,
and right-click editing. Native long-press still needs a device check.
