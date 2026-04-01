import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PolzaCreateRequest {
  model: string;
  input: {
    prompt: string;
    images: Array<{ type: 'url' | 'base64'; data: string }>;
    aspect_ratio?: string;
    image_resolution?: string;
    quality?: string;
    strength?: number;
  };
}

interface PolzaCreateResponse {
  id?: string;
  async_job_id?: string;
  status?: string;
}

interface PolzaPollResponse {
  id: string;
  status: string;
  data?: { url: string } | Array<{ url: string }>;
  usage?: { cost_rub: number };
  error?: { code: string; message: string };
}

function extractResultUrl(data: PolzaPollResponse['data']): string | undefined {
  if (!data) return undefined;
  if (Array.isArray(data)) return data[0]?.url;
  return data.url;
}

@Injectable()
export class PolzaApiService {
  private readonly logger = new Logger(PolzaApiService.name);
  private readonly apiBaseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiBaseUrl = this.config.getOrThrow<string>('POLZA_API_BASE_URL');
    this.apiKey = this.config.getOrThrow<string>('POLZA_API_KEY');
  }

  async createGeneration(request: PolzaCreateRequest): Promise<{ id: string; status: string }> {
    const url = `${this.apiBaseUrl}/v1/media`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...request, async: true }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Polza API createGeneration failed: ${response.status} ${text}`);
      throw new Error(`Polza API error: ${response.status} ${text}`);
    }

    const data = (await response.json()) as PolzaCreateResponse;
    const id = data.id ?? data.async_job_id;
    if (!id) {
      this.logger.error(`Polza API: no id in response: ${JSON.stringify(data)}`);
      throw new Error('Polza API did not return a generation id');
    }
    return { id, status: data.status ?? 'pending' };
  }

  async pollGeneration(polzaId: string): Promise<Omit<PolzaPollResponse, 'data'> & { data?: { url: string } }> {
    const url = `${this.apiBaseUrl}/v1/media/${polzaId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Polza API pollGeneration failed: ${response.status} ${text}`);
      throw new Error(`Polza API error: ${response.status} ${text}`);
    }

    const result = (await response.json()) as PolzaPollResponse;
    this.logger.debug(`Polza poll ${polzaId}: status=${result.status}, data=${JSON.stringify(result.data)}`);
    // Нормализуем data — API может вернуть массив или объект
    const resultUrl = extractResultUrl(result.data);
    return {
      ...result,
      data: resultUrl ? { url: resultUrl } : undefined,
    };
  }

  async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
