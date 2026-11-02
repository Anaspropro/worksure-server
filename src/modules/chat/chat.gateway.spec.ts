import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { SessionService } from '../../common/services/session.service';
import { UnauthorizedException } from '@nestjs/common';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let mockChatService: any;
  let mockJwtService: any;
  let mockSessionService: any;

  beforeEach(async () => {
    mockChatService = {
      ensureParticipant: jest.fn(),
      createMessage: jest.fn(),
    };
    mockJwtService = {
      verifyAsync: jest.fn(),
    };
    mockSessionService = {
      validateSession: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: mockChatService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        handshake: {
          auth: {
            token: 'valid-token',
          },
        },
        disconnect: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
      };
    });

    it('should disconnect if no token is provided', async () => {
      mockClient.handshake.auth.token = undefined;

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('should disconnect if token verification fails', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should disconnect if purpose claim is not chat_socket', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-123',
        email: 'user@example.com',
        role: 'CLIENT',
        purpose: 'access_token', // Incorrect purpose
        sessionId: 'session-456',
      });

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should disconnect if sessionId is missing in token payload', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-123',
        email: 'user@example.com',
        role: 'CLIENT',
        purpose: 'chat_socket',
        // missing sessionId
      });

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should disconnect if session is invalid or expired in Redis', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-123',
        email: 'user@example.com',
        role: 'CLIENT',
        purpose: 'chat_socket',
        sessionId: 'session-456',
      });
      mockSessionService.validateSession.mockResolvedValue(null); // Invalid session

      await gateway.handleConnection(mockClient);

      expect(mockSessionService.validateSession).toHaveBeenCalledWith(
        'session-456',
      );
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should disconnect if session userId does not match token sub', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-123',
        email: 'user@example.com',
        role: 'CLIENT',
        purpose: 'chat_socket',
        sessionId: 'session-456',
      });
      mockSessionService.validateSession.mockResolvedValue({
        sessionId: 'session-456',
        userId: 'different-user', // Mismatch!
      });

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should connect, assign user details, and join user room on valid token and session', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-123',
        email: 'user@example.com',
        role: 'CLIENT',
        purpose: 'chat_socket',
        sessionId: 'session-456',
      });
      mockSessionService.validateSession.mockResolvedValue({
        sessionId: 'session-456',
        userId: 'user-123',
      });

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).not.toHaveBeenCalled();
      expect(mockClient.user).toEqual({
        id: 'user-123',
        email: 'user@example.com',
        role: 'CLIENT',
      });
      expect(mockClient.join).toHaveBeenCalledWith('user:user-123');
    });
  });
});
