import { MetricsGuardMiddleware } from './metrics-guard.middleware';
import { UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';

describe('MetricsGuardMiddleware', () => {
  let middleware: MetricsGuardMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    middleware = new MetricsGuardMiddleware();
    mockResponse = {};
    nextFunction = jest.fn();
    delete process.env.METRICS_TOKEN;
  });

  afterEach(() => {
    delete process.env.METRICS_TOKEN;
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should allow access from localhost IPv4', () => {
    mockRequest = {
      ip: '127.0.0.1',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' } as any,
    };

    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });

  it('should allow access from localhost IPv6', () => {
    mockRequest = {
      ip: '::1',
      headers: {},
      socket: { remoteAddress: '::1' } as any,
    };

    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });

  it('should allow access from IPv4-mapped IPv6 localhost', () => {
    mockRequest = {
      ip: '::ffff:127.0.0.1',
      headers: {},
      socket: { remoteAddress: '::ffff:127.0.0.1' } as any,
    };

    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });

  it('should block access from external IP when no token is configured', () => {
    mockRequest = {
      ip: '192.168.1.50',
      headers: {},
      socket: { remoteAddress: '192.168.1.50' } as any,
    };

    expect(() => {
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
    }).toThrow(UnauthorizedException);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should block access from external IP when token is configured but not provided', () => {
    process.env.METRICS_TOKEN = 'secret-token';
    mockRequest = {
      ip: '192.168.1.50',
      headers: {},
      socket: { remoteAddress: '192.168.1.50' } as any,
    };

    expect(() => {
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
    }).toThrow(UnauthorizedException);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should block access from external IP when token is configured but wrong token is provided', () => {
    process.env.METRICS_TOKEN = 'secret-token';
    mockRequest = {
      ip: '192.168.1.50',
      headers: {
        authorization: 'Bearer wrong-token',
      },
      socket: { remoteAddress: '192.168.1.50' } as any,
    };

    expect(() => {
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
    }).toThrow(UnauthorizedException);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should allow access from external IP when token is configured and correct token is provided', () => {
    process.env.METRICS_TOKEN = 'secret-token';
    mockRequest = {
      ip: '192.168.1.50',
      headers: {
        authorization: 'Bearer secret-token',
      },
      socket: { remoteAddress: '192.168.1.50' } as any,
    };

    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });
});
