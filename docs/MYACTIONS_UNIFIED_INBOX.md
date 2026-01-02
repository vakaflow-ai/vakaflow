# MyActions - Unified Inbox (Messages & Comments Integrated) ✅

## Overview

The MyActions inbox now consolidates **all** action items in one place, including:
- **Approvals**: Approval steps pending review
- **Assessments**: Assessment assignments (TPRM, etc.)
- **Onboarding Reviews**: Onboarding requests to review
- **Tickets**: Open tickets
- **Messages**: Unread messages/comments requiring response
- **Comments**: Comments on resources (agents, reviews, policies)
- **Questions**: Questions requiring answers

## Unified Architecture

### Single Source of Truth
All action items are aggregated in the **MyActions inbox** (`/my-actions`), eliminating duplication:
- ✅ No separate Messages page needed (messages appear in inbox)
- ✅ No separate Comments page needed (comments appear in inbox)
- ✅ Everything in one place for better user experience

### Action Item Types

1. **Approval** (`approval`)
   - Approval steps pending review
   - Links to `/approvals/{instance_id}`

2. **Assessment** (`assessment`)
   - Assessment assignments to complete
   - Links to `/assessments/{assignment_id}`

3. **TPRM Questionnaire** (`tprm_questionnaire`)
   - TPRM questionnaires (same as assessment)
   - Links to `/assessments/{assignment_id}`

4. **Onboarding Review** (`onboarding_review`)
   - Onboarding requests to review
   - Links to `/reviews/{request_id}`

5. **Ticket** (`ticket`)
   - Tickets to respond to
   - Links to `/tickets/{ticket_id}`

6. **Message** (`message`)
   - Unread messages/comments requiring response
   - Links to resource page with messages tab

7. **Comment** (`comment`)
   - Comments on resources (agents, reviews, policies)
   - Links to resource page with messages tab

8. **Question** (`question`)
   - Questions requiring answers
   - Links to resource page with messages tab

## Messages & Comments Integration

### How It Works

1. **Unread Messages/Comments** appear in "Pending" tab:
   - Messages with `recipient_id = user_id` and `is_read = False`
   - Public comments on resources user owns/is involved in
   - Questions requiring answers

2. **Read Messages/Comments** appear in "Completed" tab:
   - Messages that have been read (`is_read = True`)
   - Shows when message was read

3. **Action URLs**:
   - Agent messages: `/agents/{agent_id}?tab=messages`
   - Review messages: `/reviews/{review_id}?tab=messages`
   - Policy messages: `/admin/policies/{policy_id}?tab=messages`
   - Other: `/messages?resource_type={type}&resource_id={id}`

### Message Types

- **Comment**: General comments on resources
- **Question**: Questions requiring answers
- **Reply**: Replies to comments/questions
- **Notification**: System notifications

## User Experience

### For All Users
- **Unified Inbox**: All action items in one place
- **No Duplication**: Messages/comments don't appear in separate pages
- **Clear Organization**: Pending, Completed, Overdue tabs
- **Easy Navigation**: Click to go directly to action

### For Message Recipients
- Unread messages appear in "Pending" tab
- Read messages move to "Completed" tab
- Click to view message and mark as read
- Filter by message/comment/question type

### For Resource Owners
- Public comments on their resources appear in inbox
- Questions about their resources appear in inbox
- Easy to track all activity on their resources

## Status Flow

1. **Message/Comment Created** → Appears in "Pending" tab (if unread)
2. **User Views Message** → Can mark as read
3. **Message Marked as Read** → Moves to "Completed" tab
4. **User Responds** → Message remains in completed (response creates new message)

## Filtering

Users can filter by:
- **All Types**: Show all action items
- **Approvals**: Only approval steps
- **Assessments**: Only assessment assignments
- **TPRM Questionnaires**: Only TPRM questionnaires
- **Onboarding Reviews**: Only onboarding requests
- **Tickets**: Only tickets
- **Messages**: Only unread messages
- **Comments**: Only comments
- **Questions**: Only questions

## Implementation Details

### Backend Changes

1. **ActionItemType Enum** (`backend/app/models/action_item.py`):
   - Added `MESSAGE`, `COMMENT`, `QUESTION` types

2. **ActionItemService** (`backend/app/services/action_item_service.py`):
   - Added logic to query unread messages/comments
   - Added logic to query read messages/comments (for completed section)
   - Determines action type based on message type
   - Builds appropriate action URLs based on resource type

3. **Message Query Logic**:
   ```python
   # Unread messages for user
   unread_messages = db.query(Message).filter(
       Message.tenant_id == tenant_id,
       Message.is_read == False,
       Message.is_archived == False,
       or_(
           Message.recipient_id == user_id,  # Direct messages
           and_(
               Message.recipient_id.is_(None),  # Public comments
               Message.resource_type.in_(["agent", "review", "policy"])
           )
       )
   ).all()
   ```

### Frontend Changes

1. **MyActions Page** (`frontend/src/pages/MyActions.tsx`):
   - Added message/comment/question icons
   - Added filter options for messages/comments/questions
   - Added color coding for message types (indigo)

2. **Icon Mapping**:
   - Messages/Comments/Questions use `MessageSquare` icon
   - Indigo color scheme for visual distinction

## Benefits

### ✅ No Duplication
- Messages/comments appear only in MyActions inbox
- No need to check multiple pages
- Single source of truth

### ✅ Better Organization
- All action items in one place
- Clear status (pending/completed)
- Easy filtering and search

### ✅ Improved UX
- Users see everything requiring action
- Easy to prioritize and respond
- Clear visual distinction between types

### ✅ Consistent Experience
- Same interface for all action types
- Consistent navigation patterns
- Unified status management

## Migration Notes

### Existing Messages Page
- The `/messages` page still exists for detailed message viewing
- Messages now also appear in MyActions inbox
- Users can access messages from either location
- Inbox provides quick overview, Messages page provides detailed view

### Backward Compatibility
- All existing message/comment functionality remains
- No breaking changes to message API
- Messages page still functional
- Inbox is an additional view, not a replacement

## Future Enhancements

1. **Real-time Updates**
   - WebSocket notifications for new messages
   - Auto-refresh when messages are read

2. **Bulk Actions**
   - Mark multiple messages as read
   - Archive multiple messages

3. **Advanced Filtering**
   - Filter by resource type
   - Filter by sender
   - Filter by date range

4. **Search**
   - Search messages/comments by content
   - Search by sender name

## Files Modified

### Backend
- ✅ `backend/app/models/action_item.py` - Added MESSAGE, COMMENT, QUESTION types
- ✅ `backend/app/services/action_item_service.py` - Added message/comment aggregation

### Frontend
- ✅ `frontend/src/pages/MyActions.tsx` - Added message/comment/question support

## Status

✅ **Unified Inbox Complete**
- Messages integrated
- Comments integrated
- Questions integrated
- No duplication
- Single source of truth

---

**Result**: All action items (approvals, assessments, tickets, messages, comments, questions) now appear in the unified MyActions inbox, eliminating duplication and providing a single place for users to manage all their action items.
