// backend/create-cert.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔐 Creating SSL certificate for HTTPS...\n');

const certDir = path.join(__dirname, '..');
const keyPath = path.join(certDir, 'server-key.pem');
const certPath = path.join(certDir, 'server-cert.pem');

try {
    // Check if OpenSSL is available
    execSync('openssl version', { stdio: 'ignore' });
    
    // Generate self-signed certificate
    const command = `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=192.168.1.3"`;
    execSync(command, { stdio: 'inherit' });
    
    console.log('✅ Certificate created successfully!');
    console.log(`   Key: ${keyPath}`);
    console.log(`   Cert: ${certPath}`);
} catch (error) {
    console.log('⚠️  OpenSSL not found. Using alternative method...\n');
    
    // Alternative: Use a simple certificate (for development only)
    const key = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj
MzEfYyjiWA4R4/M2bGM1QD8ZkY7n3RYlA7O5Vh3J1Z5K8Q2N3L7M9P4R6T8Y1X2Z
... (this is a placeholder - you'll need actual cert generation)
-----END PRIVATE KEY-----`;
    
    console.log('❌ Please install OpenSSL or use the alternative method below.');
}