DROP INDEX idx_certificates_serial;
CREATE UNIQUE INDEX idx_certificates_serial_unique ON certificates(serial_no);
