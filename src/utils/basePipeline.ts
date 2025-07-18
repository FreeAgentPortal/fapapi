import mongoose from 'mongoose';

export interface LookupConfig {
  from: string;
  localField: string;
  foreignField: string;
  as: string;
  pipeline?: any[];
  let?: Record<string, any>;
}

export interface ProjectionConfig {
  include?: string[];
  exclude?: string[];
  custom?: Record<string, any>;
}

export interface UnwindConfig {
  path: string;
  preserveNullAndEmptyArrays?: boolean;
  includeArrayIndex?: string;
}

export abstract class BasePipeline {
  /**
   * Creates a basic lookup stage
   */
  protected static createLookup(config: LookupConfig): any {
    const lookup: any = {
      $lookup: {
        from: config.from,
        localField: config.localField,
        foreignField: config.foreignField,
        as: config.as,
      },
    };

    if (config.pipeline) {
      lookup.$lookup.pipeline = config.pipeline;
    }

    if (config.let) {
      lookup.$lookup.let = config.let;
    }

    return lookup;
  }

  /**
   * Creates a conditional lookup based on a field value
   */
  protected static createConditionalLookup(from: string, letVars: Record<string, any>, matchConditions: any[], as: string, pipeline?: any[]): any {
    return {
      $lookup: {
        from,
        let: letVars,
        pipeline: [
          {
            $match: {
              $expr: {
                $and: matchConditions,
              },
            },
          },
          ...(pipeline || []),
        ],
        as,
      },
    };
  }

  /**
   * Creates a projection stage
   */
  protected static createProjection(config: ProjectionConfig): any {
    const projection: Record<string, any> = {};

    if (config.include) {
      config.include.forEach((field) => {
        projection[field] = 1;
      });
    }

    if (config.exclude) {
      config.exclude.forEach((field) => {
        projection[field] = 0;
      });
    }

    if (config.custom) {
      Object.assign(projection, config.custom);
    }

    return { $project: projection };
  }

  /**
   * Creates an unwind stage
   */
  protected static createUnwind(config: UnwindConfig): any {
    const unwind: any = {
      $unwind: {
        path: config.path,
      },
    };

    if (config.preserveNullAndEmptyArrays !== undefined) {
      unwind.$unwind.preserveNullAndEmptyArrays = config.preserveNullAndEmptyArrays;
    }

    if (config.includeArrayIndex) {
      unwind.$unwind.includeArrayIndex = config.includeArrayIndex;
    }

    return unwind;
  }

  /**
   * Creates an addFields stage for conditional field merging
   */
  protected static createConditionalFieldMerge(fieldName: string, condition: any, trueValue: any, falseValue: any): any {
    return {
      $addFields: {
        [fieldName]: {
          $cond: {
            if: condition,
            then: trueValue,
            else: falseValue,
          },
        },
      },
    };
  }

  /**
   * Creates a switch-based field merge for multiple conditions
   */
  protected static createSwitchFieldMerge(fieldName: string, branches: Array<{ case: any; then: any }>, defaultValue: any = null): any {
    return {
      $addFields: {
        [fieldName]: {
          $switch: {
            branches,
            default: defaultValue,
          },
        },
      },
    };
  }

  /**
   * Creates a standard user lookup with basic fields
   */
  protected static createUserLookup(localField: string = 'user', as: string = 'user', fields: string[] = ['_id', 'fullName', 'profileImageUrl', 'email']): any {
    return this.createLookup({
      from: 'users',
      localField,
      foreignField: '_id',
      as,
      pipeline: [
        this.createProjection({
          include: fields,
        }),
      ],
    });
  }

  /**
   * Creates a facet stage for pagination
   */
  protected static createPaginationFacet(page: number, limit: number, entriesPipeline: any[] = []): any {
    return {
      $facet: {
        metadata: [{ $count: 'totalCount' }, { $addFields: { page, limit } }],
        entries: [{ $skip: (page - 1) * limit }, { $limit: limit }, ...entriesPipeline],
      },
    };
  }

  /**
   * Creates a match stage for ObjectId
   */
  protected static createIdMatch(id: string, field: string = '_id'): any {
    return {
      $match: {
        [field]: new mongoose.Types.ObjectId(id),
      },
    };
  }

  /**
   * Creates a dynamic match stage based on filters and queries
   */
  protected static createDynamicMatch(filters: Array<object>, queries: Array<object> = []): any {
    return {
      $match: {
        $and: [...filters],
        ...(queries.length > 0 && { $or: queries }),
      },
    };
  }

  /**
   * Creates a sort stage
   */
  protected static createSort(sortOptions: Record<string, 1 | -1>): any {
    return {
      $sort: sortOptions,
    };
  }

  /**
   * Combines multiple pipeline stages into a single array
   */
  protected static combinePipelines(...pipelines: any[][]): any[] {
    return pipelines.flat();
  }

  /**
   * Abstract method that child classes must implement to return their complete pipeline
   */
  abstract getCompleteEntriesPipeline(): any[];

  /**
   * Abstract method for getting a minimal pipeline (for list views)
   */
  abstract getMinimalEntriesPipeline(): any[];

  /**
   * Optional method for getting a detailed pipeline (for single item views)
   * Default implementation returns the complete pipeline
   */
  getDetailedEntriesPipeline(): any[] {
    return this.getCompleteEntriesPipeline();
  }

  /**
   * Method to get a full aggregation pipeline with pagination
   */
  getFullPipeline(
    filters: Array<object>,
    queries: Array<object>,
    sortOptions: Record<string, 1 | -1>,
    page: number,
    limit: number,
    pipelineType: 'minimal' | 'complete' | 'detailed' = 'complete'
  ): any[] {
    let entriesPipeline: any[];

    switch (pipelineType) {
      case 'minimal':
        entriesPipeline = this.getMinimalEntriesPipeline();
        break;
      case 'detailed':
        entriesPipeline = this.getDetailedEntriesPipeline();
        break;
      default:
        entriesPipeline = this.getCompleteEntriesPipeline();
    }

    return [BasePipeline.createDynamicMatch(filters, queries), BasePipeline.createSort(sortOptions), BasePipeline.createPaginationFacet(page, limit, entriesPipeline)];
  }

  /**
   * Method to get a simple aggregation pipeline (no pagination)
   */
  getSimplePipeline(id: string, pipelineType: 'minimal' | 'complete' | 'detailed' = 'detailed'): any[] {
    let entriesPipeline: any[];

    switch (pipelineType) {
      case 'minimal':
        entriesPipeline = this.getMinimalEntriesPipeline();
        break;
      case 'complete':
        entriesPipeline = this.getCompleteEntriesPipeline();
        break;
      default:
        entriesPipeline = this.getDetailedEntriesPipeline();
    }

    return [BasePipeline.createIdMatch(id), ...entriesPipeline];
  }
}
