-- Tie single-use WebSocket tickets to the same revocable session as HTTP requests.
ALTER TABLE realtime_tickets ADD COLUMN session_hash TEXT REFERENCES sessions(token_hash) ON DELETE CASCADE;
CREATE INDEX realtime_tickets_session ON realtime_tickets(session_hash);
