<template>
  <bk-table
    :data="tableInstances"
    :pagination="tablePagination"
    size="small"
    dark-header
    v-bkloading="{ isLoading: tableLoading, zIndex: 10 }"
    @page-change="handlePageChange"
    @page-limit-change="handlePageLimitChange"
  >
    <div slot="empty">
      <table-empty empty />
    </div>
    <bk-table-column
      v-for="column in columns"
      :key="column.prop"
      :label="$t(column.label)"
      :prop="column.prop"
      show-overflow-tooltip
    >
      <template slot-scope="{ row }">
        {{ row[column.prop] || '--' }}
      </template>
    </bk-table-column>
  </bk-table>
</template>

<script>
const DEFAULT_PAGINATION = {
  current: 1,
  count: 0,
  limit: 5,
  limitList: [5, 10, 20, 50, 100],
};

export default {
  name: 'AffectedInstancesTable',
  props: {
    quotaPlanId: {
      type: [Number, String],
      default: null,
    },
    initialInstances: {
      type: Array,
      default: () => [],
    },
    initialCount: {
      type: Number,
      default: 0,
    },
    defaultLimit: {
      type: Number,
      default: 5,
    },
  },
  data() {
    return {
      tableLoading: false,
      tableInstances: [...this.initialInstances],
      tablePagination: this.createPagination({ count: this.initialCount }),
      hasUsedInitialData: false,
    };
  },
  computed: {
    columns() {
      // 影响实例表会同时复用在侧栏和删除拦截弹窗中，列配置集中在这里便于两处保持一致。
      return [
        { label: '应用 ID', prop: 'app_code' },
        { label: '模块', prop: 'module_name' },
        { label: '进程', prop: 'process_name' },
      ];
    },
  },
  watch: {
    quotaPlanId: {
      immediate: true,
      handler() {
        this.resetTable();
        if (this.quotaPlanId) {
          this.getAffectedInstances();
        }
      },
    },
  },
  methods: {
    createPagination(overrides = {}) {
      return {
        ...DEFAULT_PAGINATION,
        limit: this.defaultLimit,
        ...overrides,
      };
    },
    resetTable() {
      this.tableInstances = [...this.initialInstances];
      this.tablePagination = this.createPagination({ count: this.initialCount });
      this.hasUsedInitialData = false;
    },
    getQueryParams() {
      const { current, limit } = this.tablePagination;
      return {
        limit,
        offset: limit * (current - 1),
      };
    },
    async getAffectedInstances() {
      if (!this.quotaPlanId) return;

      // 删除拦截弹窗会传入预检查接口返回的第一页数据，避免打开弹窗后重复请求。
      if (!this.hasUsedInitialData && this.initialInstances.length) {
        this.hasUsedInitialData = true;
        return;
      }

      this.tableLoading = true;
      try {
        // 表格负责分页查询方案绑定的应用 / 模块 / 进程，调用方只需要提供方案 ID。
        const res = await this.$store.dispatch('tenantConfig/getResQuotaPlanUsedBy', {
          id: this.quotaPlanId,
          queryParams: this.getQueryParams(),
        });
        this.tableInstances = res.results || [];
        this.tablePagination.count = res.count || 0;
        this.$emit('count-change', this.tablePagination.count);
      } catch (e) {
        this.tableInstances = [];
        this.tablePagination.count = 0;
        this.catchErrorHandler(e);
      } finally {
        this.tableLoading = false;
      }
    },
    handlePageChange(page) {
      this.tablePagination.current = page;
      this.getAffectedInstances();
    },
    handlePageLimitChange(limit) {
      this.tablePagination.current = 1;
      this.tablePagination.limit = limit;
      this.getAffectedInstances();
    },
  },
};
</script>
