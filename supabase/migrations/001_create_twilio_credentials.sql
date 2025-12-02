-- Migration to create the twilio_credentials table

CREATE TABLE twilio_credentials (
    id SERIAL PRIMARY KEY,
    account_sid VARCHAR(255) NOT NULL,
    auth_token VARCHAR(255) NOT NULL,
    from_phone_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
