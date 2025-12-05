/**
 * Mock for whois module
 */

export const lookup = jest.fn((domain: string, callback: (err: Error | null, data: string) => void) => {
  callback(null, `Domain Name: ${domain}\nRegistrar: Mock Registrar\nCreation Date: 2020-01-01\nExpiration Date: 2025-01-01\nName Server: ns1.example.com\nName Server: ns2.example.com\nDomain Status: ok`);
});

export default {
  lookup,
};
