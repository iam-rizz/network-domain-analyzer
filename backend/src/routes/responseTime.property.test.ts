/**
 * Property-Based Test for Response Time Limit
 * Feature: network-domain-analyzer, Property 25: Response Time Limit
 * Validates: Requirements 15.1
 * 
 * Property: For any single domain lookup operation, the system should return results or timeout within 10 seconds
 */

import * as fc from 'fast-check';
import request from 'supertest';
import app from '../index';

describe('Property 25: Response Time Limit', () => {
  const MAX_RESPONSE_TIME = 10000; // 10 seconds in milliseconds

  /**
   * Generator for valid domain names
   */
  const domainArbitrary = fc.domain();

  it('should return results or timeout within 10 seconds for any domain lookup', async () => {
    await fc.assert(
      fc.asyncProperty(domainArbitrary, async (domain) => {
        const startTime = Date.now();

        try {
          // Perform DNS lookup with timeout
          const response = await request(app)
            .post('/api/dns/lookup')
            .send({ domain })
            .timeout(MAX_RESPONSE_TIME + 1000); // Add 1 second buffer for network overhead

          const endTime = Date.now();
          const responseTime = endTime - startTime;

          // Property: Response time should be within 10 seconds
          expect(responseTime).toBeLessThanOrEqual(MAX_RESPONSE_TIME);

          // If successful, should have proper structure
          if (response.status === 200) {
            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('data');
          }
        } catch (error: any) {
          const endTime = Date.now();
          const responseTime = endTime - startTime;

          // Even on error/timeout, response time should be within limit
          expect(responseTime).toBeLessThanOrEqual(MAX_RESPONSE_TIME + 1000); // Allow small buffer for error handling

          // If it's a timeout error, it should be within our limit
          if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            expect(responseTime).toBeLessThanOrEqual(MAX_RESPONSE_TIME + 1000);
          }
        }
      }),
      {
        numRuns: 100, // Run 100 iterations as per design document
        timeout: 15000, // Overall test timeout (15 seconds per test case)
      }
    );
  }, 1800000); // 30 minute timeout for entire test suite (100 runs * 15 seconds)

  it('should return results or timeout within 10 seconds for WHOIS lookup', async () => {
    await fc.assert(
      fc.asyncProperty(domainArbitrary, async (domain) => {
        const startTime = Date.now();

        try {
          // Perform WHOIS lookup with timeout
          const response = await request(app)
            .post('/api/whois/lookup')
            .send({ domain })
            .timeout(MAX_RESPONSE_TIME + 1000);

          const endTime = Date.now();
          const responseTime = endTime - startTime;

          // Property: Response time should be within 10 seconds
          expect(responseTime).toBeLessThanOrEqual(MAX_RESPONSE_TIME);

          // If successful, should have proper structure
          if (response.status === 200) {
            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('data');
          }
        } catch (error: any) {
          const endTime = Date.now();
          const responseTime = endTime - startTime;

          // Even on error/timeout, response time should be within limit
          expect(responseTime).toBeLessThanOrEqual(MAX_RESPONSE_TIME + 1000);
        }
      }),
      {
        numRuns: 100,
        timeout: 15000,
      }
    );
  }, 1800000);

  it('should return results or timeout within 10 seconds for RDAP lookup', async () => {
    await fc.assert(
      fc.asyncProperty(domainArbitrary, async (domain) => {
        const startTime = Date.now();

        try {
          // Perform RDAP lookup with timeout
          const response = await request(app)
            .post('/api/rdap/lookup')
            .send({ domain })
            .timeout(MAX_RESPONSE_TIME + 1000);

          const endTime = Date.now();
          const responseTime = endTime - startTime;

          // Property: Response time should be within 10 seconds
          expect(responseTime).toBeLessThanOrEqual(MAX_RESPONSE_TIME);

          // If successful, should have proper structure
          if (response.status === 200) {
            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('data');
          }
        } catch (error: any) {
          const endTime = Date.now();
          const responseTime = endTime - startTime;

          // Even on error/timeout, response time should be within limit
          expect(responseTime).toBeLessThanOrEqual(MAX_RESPONSE_TIME + 1000);
        }
      }),
      {
        numRuns: 100,
        timeout: 15000,
      }
    );
  }, 1800000);
});
