# Minute Management System Update

## Overview
We have upgraded the minute management system to support a dual-balance approach, allowing users to have both **Agency Minutes** (allocated by an agency) and **Direct Minutes** (purchased directly).

## Key Features

### 1. Dual Balance Display
- Users now see both **Agency Minutes** and **Direct Minutes** in the sidebar.
- **Agency Minutes**: Minutes allocated to the user by their agency.
- **Direct Minutes**: Minutes purchased directly by the user via the platform.
- If a user belongs to an agency, they will see both balances, even if one is zero.

### 2. Priority Deduction Logic
When a call is made, minutes are deducted based on the following priority:
1.  **Agency Minutes First**: The system checks if the user has enough Agency Minutes to cover the *entire* call duration.
2.  **Direct Minutes Fallback**: If Agency Minutes are insufficient, the system checks the Direct Minutes balance.
3.  **Atomic Deduction**: Minutes for a single call are deducted entirely from *one* source. We do not split a single call's cost between two balances.

### 3. Live Updates
- During an active call, the sidebar now updates the minute display in real-time (second by second).
- The local countdown mimics the backend logic: it decrements Agency Minutes first, and only decrements Direct Minutes if Agency Minutes are exhausted (or if the call started with Direct Minutes).
- Once the call ends, the balances sync with the server to ensure accuracy.

## Technical Implementation

### Backend (`MinuteBalanceService`)
- **`getBalance(userId)`**: Fetches both `agency_users` and `pricing` table records. Determines if the user is 'agency', 'direct', or 'both'.
- **`deductMinutes(userId, seconds)`**: Implements the priority logic.
    - Checks `agencyBalance >= seconds`. If yes, deducts from `agency_users`.
    - Else, checks `directBalance >= seconds`. If yes, deducts from `pricing`.
    - Returns the new balances and the source of deduction.

### Frontend (`Sidebar` & `usePricing`)
- **`Sidebar.tsx`**:
    - Maintains a local `timeInterval` when `callStarted` is true.
    - Decrements the appropriate local balance every second.
    - Syncs with the global store (`usePricingToolsStore`) when the call ends.
- **`use-pricing-store.ts`**:
    - Stores `agencyTime`, `directTime`, and `userType`.
    - Updates these values based on the response from `MinuteBalanceService`.

## User Experience
- **Agency Users**: Will see their allocated minutes and any personal top-ups. Agency minutes are used first, saving their personal funds.
- **Direct Users**: Will see their purchased minutes as usual.
- **Real-time Feedback**: Users can see their remaining time decrease as they talk, providing better visibility into their usage.
