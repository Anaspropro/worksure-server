import { StringValue } from 'ms';
export declare class AppConfigService {
    get port(): number;
    get databaseUrl(): string | undefined;
    get isDatabaseConfigured(): boolean;
    get jwtSecret(): string;
    get jwtExpiresIn(): StringValue;
}
