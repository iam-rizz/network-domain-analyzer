/**
 * Routes Integration Tests
 * Tests API endpoints
 */

import request from 'supertest';
import app from '../index';

describe('API Routes', () => {
  describe('Health Check', () => {
    it('should return 200 OK for health check', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('DNS Routes', () => {
    it('should return 400 for missing domain in DNS lookup', async () => {
      const response = await request(app)
        .post('/api/dns/lookup')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing domain in propagation check', async () => {
      const response = await request(app)
        .post('/api/dns/propagation')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('RDAP Routes', () => {
    it('should return 400 for missing domain in RDAP lookup', async () => {
      const response = await request(app)
        .post('/api/rdap/lookup')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return bootstrap info', async () => {
      const response = await request(app).get('/api/rdap/bootstrap');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('WHOIS Routes', () => {
    it('should return 400 for missing domain in WHOIS lookup', async () => {
      const response = await request(app)
        .post('/api/whois/lookup')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Host Routes', () => {
    it('should return 400 for missing host in ping', async () => {
      const response = await request(app)
        .post('/api/host/ping')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing url in HTTP check', async () => {
      const response = await request(app)
        .post('/api/host/http-check')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing host in port scan', async () => {
      const response = await request(app)
        .post('/api/host/port-scan')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing domain in SSL check', async () => {
      const response = await request(app)
        .post('/api/host/ssl-check')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('IP Routes', () => {
    it('should return 400 for missing IP in lookup', async () => {
      const response = await request(app)
        .post('/api/ip/lookup')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Batch Routes', () => {
    it('should return 401 for missing API key', async () => {
      const response = await request(app)
        .post('/api/batch/analyze')
        .send({ domains: ['example.com'] });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('History Routes', () => {
    it('should return history list', async () => {
      const response = await request(app).get('/api/history');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    it('should return 404 for non-existent analysis', async () => {
      const response = await request(app).get('/api/history/non-existent-id');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 for export without API key', async () => {
      const response = await request(app)
        .post('/api/history/export')
        .send({ ids: ['test-id'], format: 'json' });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent route', async () => {
      const response = await request(app).get('/api/non-existent');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });
});
