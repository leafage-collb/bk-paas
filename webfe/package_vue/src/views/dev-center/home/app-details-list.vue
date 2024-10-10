<template>
  <div class="app-details-list-container">
    <h3 class="title">{{ $t('应用详情') }}</h3>
    <div class="card-style">
      <bk-table
        :data="appList"
        size="medium"
        ref="appTableCls"
        :pagination="pagination"
        :outer-border="false"
        v-bkloading="{ isLoading: isLoading, zIndex: 10 }"
        ext-cls="app-details-table-cls"
        @page-change="handlePageChange"
        @page-limit-change="handlePageLimitChange"
        @filter-change="handleFilterChange"
      >
        <div slot="empty">
          <table-empty
            :keyword="tableEmptyConf.keyword"
            :abnormal="tableEmptyConf.isAbnormal"
            @reacquire="getAppDetails"
            @clear-filter="clearFilterKey"
          />
        </div>
        <bk-table-column
          :label="$t('应用')"
          prop="name"
          :min-width="280"
        >
          <template slot-scope="{ row }">
            <div class="app-name">
              <img
                :src="row.logo_url || defaultImg"
                class="app-logo"
              />
              <div class="info">
                <span
                  class="name"
                  @click.stop="toPage(row)"
                >
                  {{ row.name }}
                </span>
                <span class="code">{{ row.code }}</span>
              </div>
            </div>
          </template>
        </bk-table-column>
        <bk-table-column
          :label="$t('资源配额')"
          show-overflow-tooltip
        >
          <template slot-scope="{ row }">
            {{ row?.mem_limits / 1024 }} G / {{ (row?.cpu_limits / 1000).toFixed(2) }} {{ $t('核') }}
          </template>
        </bk-table-column>
        <bk-table-column
          :label="`CPU ${$t('使用率')} (7d)`"
          sortable
          :render-header="$renderHeader"
        >
          <template slot-scope="{ row }">{{ (row?.cpu_usage_avg * 100).toFixed(2) }}%</template>
        </bk-table-column>
        <bk-table-column
          label="PV (30d)"
          prop="pv"
          sortable
        ></bk-table-column>
        <bk-table-column
          label="UV (30d)"
          prop="uv"
          sortable
        ></bk-table-column>
        <bk-table-column
          :label="$t('最近操作时间')"
          :render-header="$renderHeader"
        >
          <template slot-scope="{ row }">{{ formatTime(row.latest_operated_at) }}</template>
        </bk-table-column>
        <bk-table-column
          :label="$t('应用状态')"
          :filters="statusFilters"
          :filter-multiple="false"
          prop="issue_type"
          column-key="issue_type"
          show-overflow-tooltip
        >
          <template slot-scope="{ row }">
            <i :class="['dot', row.issue_type]"></i>
            <span>
              {{ $t(APP_DATAILS_STATUS[row.issue_type]) || '--' }}
            </span>
          </template>
        </bk-table-column>
      </bk-table>
    </div>
  </div>
</template>

<script>
import { formatTime } from '@/common/tools';
import { APP_DATAILS_STATUS } from '@/common/constants';
import { bus } from '@/common/bus';
export default {
  name: 'AppDetailsList',
  data() {
    return {
      appList: [{}],
      isLoading: false,
      pagination: {
        current: 1,
        count: 0,
        limit: 10,
        limitList: [5, 10, 20, 50],
      },
      tableEmptyConf: {
        keyword: '',
        isAbnormal: false,
      },
      defaultImg: '/static/images/default_logo.png',
      formatTime,
      APP_DATAILS_STATUS,
      statusFilterKey: '',
    };
  },
  computed: {
    statusFilters() {
      const arr = [];
      Object.keys(APP_DATAILS_STATUS).forEach((key) => {
        arr.push({
          text: APP_DATAILS_STATUS[key],
          value: key,
        });
      });
      return arr;
    },
  },
  created() {
    this.init();
  },
  methods: {
    init() {
      this.getAppDetails();
    },
    handlePageChange(page) {
      this.pagination.current = page;
      this.getAppDetails();
    },
    handlePageLimitChange(newLimit) {
      this.pagination.limit = newLimit;
      this.getAppDetails();
    },
    // 字段过滤
    handleFilterChange(filters) {
      if (Object.keys(filters).length) {
        this.statusFilterKey = filters.issue_type.join();
        this.pagination.current = 1;
        this.getAppDetails();
      }
    },
    // 获取应用详情列表
    async getAppDetails() {
      this.isLoading = true;
      const params = {
        offset: this.pagination.limit * (this.pagination.current - 1), // 页偏移量
        limit: this.pagination.limit, // 页容量
        ...(this.statusFilterKey && { issue_type: this.statusFilterKey }),
      };
      try {
        const res = await this.$store.dispatch('baseInfo/getAppDetails', {
          params,
        });
        this.appList = res.results.applications || [];
        this.pagination.count = res.count;
        this.updateTableEmptyConfig();
      } catch (e) {
        this.catchErrorHandler(e);
      } finally {
        this.isLoading = false;
        bus.$emit('on-close-loading');
      }
    },
    // 清空筛选
    clearFilterKey() {
      this.statusFilterKey = '';
      this.$refs.appTableCls?.clearFilter();
    },
    updateTableEmptyConfig() {
      this.tableEmptyConf.keyword = this.statusFilterKey;
    },
    toPage(row) {
      const routeName = row?.type === 'cloud_native' ? 'cloudAppSummary' : 'appSummary';
      this.$router.push({
        name: routeName,
        params: {
          id: row.code,
          moduleId: 'default',
        },
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.app-details-list-container {
  margin-top: 24px;
  .title {
    font-weight: 700;
    font-size: 16px;
    color: #313238;
  }
  .card-style {
    margin-top: 12px;
  }
  .app-details-table-cls {
    .bk-table-pagination-wrapper {
      background-color: #ffffff;
    }
    .app-name {
      display: flex;
      img {
        width: 32px;
        height: 32px;
      }
      .info {
        display: flex;
        flex-flow: column;
        justify-content: center;
        margin-left: 8px;
        font-size: 12px;
        color: #63656e;
        .name {
          font-weight: 700;
          font-size: 12px;
          color: #3a84ff;
          cursor: pointer;
        }
      }
    }
    i.dot {
      display: inline-block;
      margin-right: 8px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f0f1f5;
      border: 1px solid #c4c6cc;
      &.none {
        background: #e5f6ea;
        border: 1px solid #3fc06d;
      }
      &.misconfigured {
        background: #ffe6e6;
        border: 1px solid #ea3636;
      }
    }
  }
}
</style>
