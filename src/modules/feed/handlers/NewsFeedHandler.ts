import axios from 'axios';
import { ErrorUtil } from '../../../middleware/ErrorUtil';

// WordPress API interfaces
export interface WordPressPost {
  id: number;
  date: string;
  date_gmt: string;
  guid: {
    rendered: string;
  };
  modified: string;
  modified_gmt: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
    protected: boolean;
  };
  excerpt: {
    rendered: string;
    protected: boolean;
  };
  author: number;
  featured_media: number;
  comment_status: string;
  ping_status: string;
  sticky: boolean;
  template: string;
  format: string;
  meta: Record<string, any>;
  categories: number[];
  tags: number[];
  _links: Record<string, any>;
}

export interface PaginationOptions {
  page?: number;
  per_page?: number;
  offset?: number;
  order?: 'asc' | 'desc';
  orderby?: 'author' | 'date' | 'id' | 'include' | 'modified' | 'parent' | 'relevance' | 'slug' | 'include_slugs' | 'title';
  search?: string;
  after?: string;
  author?: number[];
  author_exclude?: number[];
  before?: string;
  exclude?: number[];
  include?: number[];
  sticky?: boolean;
  categories?: number[];
  categories_exclude?: number[];
  tags?: number[];
  tags_exclude?: number[];
}

export interface WordPressApiResponse {
  posts: WordPressPost[];
  totalPosts: number;
  totalPages: number;
  currentPage: number;
}

export class NewsFeedHandler {
  private readonly wpBaseUrl = 'https://nfldraftdiamonds.com';
  private readonly wpApiEndpoint = '/wp-json/wp/v2/posts?_fields=id,title,excerpt,slug,date,link,author,featured_media,categories,tags,content,yoast_head_json,image';

  /**
   * Fetches articles from the WordPress site with pagination support
   * @param paginationOptions - Pagination and filtering options
   * @returns Promise containing the articles and pagination info
   */
  async fetchArticles(paginationOptions: PaginationOptions = {}): Promise<WordPressApiResponse> {
    try {
      // Set default pagination options
      const { page = 1, per_page = 10, order = 'desc', orderby = 'date', ...otherParams } = paginationOptions;

      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        per_page: per_page.toString(),
        order,
        orderby,
        ...this.buildQueryParams(otherParams),
      });

      const url = `${this.wpBaseUrl}${this.wpApiEndpoint}?${queryParams.toString()}`;

      // Make the API request
      const response = await axios.get(url, {
        // timeout: 10000, // 10 seconds timeout
        headers: {
          Accept: 'application/json',
          'User-Agent': 'FreeAgentPortal/1.0',
        },
      });

      // Extract pagination info from headers
      const totalPosts = parseInt(response.headers['x-wp-total'] || '0', 10);
      const totalPages = parseInt(response.headers['x-wp-totalpages'] || '0', 10);

      return {
        posts: response.data,
        totalPosts,
        totalPages,
        currentPage: page,
      };
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Server responded with error status
          throw new ErrorUtil(`WordPress API error: ${error.response.status} - ${error.response.statusText}`, error.response.status);
        } else if (error.request) {
          // Request was made but no response received
          throw new ErrorUtil('No response from WordPress API - network error', 503);
        } else {
          // Something else happened
          throw new ErrorUtil(`Request setup error: ${error.message}`, 500);
        }
      } else {
        throw new ErrorUtil(`Unexpected error fetching articles: ${error.message}`, 500);
      }
    }
  }

  /**
   * Helper method to build query parameters from pagination options
   * @param params - Additional query parameters
   * @returns Object with string values for URLSearchParams
   */
  private buildQueryParams(params: Partial<PaginationOptions>): Record<string, string> {
    const queryParams: Record<string, string> = {};

    // Handle array parameters
    if (params.author && params.author.length > 0) {
      queryParams.author = params.author.join(',');
    }
    if (params.author_exclude && params.author_exclude.length > 0) {
      queryParams.author_exclude = params.author_exclude.join(',');
    }
    if (params.exclude && params.exclude.length > 0) {
      queryParams.exclude = params.exclude.join(',');
    }
    if (params.include && params.include.length > 0) {
      queryParams.include = params.include.join(',');
    }
    if (params.categories && params.categories.length > 0) {
      queryParams.categories = params.categories.join(',');
    }
    if (params.categories_exclude && params.categories_exclude.length > 0) {
      queryParams.categories_exclude = params.categories_exclude.join(',');
    }
    if (params.tags && params.tags.length > 0) {
      queryParams.tags = params.tags.join(',');
    }
    if (params.tags_exclude && params.tags_exclude.length > 0) {
      queryParams.tags_exclude = params.tags_exclude.join(',');
    }

    // Handle simple parameters
    if (params.offset !== undefined) {
      queryParams.offset = params.offset.toString();
    }
    if (params.search) {
      queryParams.search = params.search;
    }
    if (params.after) {
      queryParams.after = params.after;
    }
    if (params.before) {
      queryParams.before = params.before;
    }
    if (params.sticky !== undefined) {
      queryParams.sticky = params.sticky.toString();
    }

    return queryParams;
  }

  // fetch news feed items from wp-site
}
