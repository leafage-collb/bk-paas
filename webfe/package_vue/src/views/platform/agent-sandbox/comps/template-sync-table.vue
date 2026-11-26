<template>
  <section class="sync-table-section">
    <div class="sync-table-header">
      <h3>{{ $t('按模板') }}</h3>
      <div class="sync-toolbar">
        <bk-input
          v-model="keyword"
          :placeholder="$t('搜索模板、所属应用、资源名')"
          clearable
          right-icon="bk-icon icon-search"
          class="sync-search"
        />
        <bk-select v-model="typeFilter" :clearable="false" class="sync-filter">
          <bk-option id="all" :name="$t('全部类型')" />
          <bk-option id="builtin" :name="$t('内置')" />
          <bk-option id="custom" :name="$t('自定义')" />
        </bk-select>
        <bk-select v-model="statusFilter" :clearable="false" class="sync-filter">
          <bk-option id="all" :name="$t('全部状态')" />
          <bk-option v-for="option in statusOptions" :key="option.id" :id="option.id" :name="option.name" />
        </bk-select>
      </div>
    </div>
    <bk-table
      :data="pagedTemplates"
      :outer-border="false"
      :pagination="pagination"
      class="sync-table"
      row-key="resource_name"
      @page-change="page = $event"
      @page-limit-change="changeLimit"
    >
      <bk-table-column :label="$t('模板')" min-width="170">
        <template slot-scope="{ row }">
          <div class="template-heading">
            <div class="template-name" :title="row.name || row.template_id">{{ row.name || row.template_id }}</div>
            <span v-if="row.enabled === false" class="disabled-tag">{{ $t('停用') }}</span>
          </div>
          <div class="template-id" :title="row.template_id">{{ row.template_id }}</div>
        </template>
      </bk-table-column>
      <bk-table-column :label="$t('类型')" width="105">
        <template slot-scope="{ row }">
          <span :class="['type-tag', { builtin: row.is_builtin === true }]">{{ typeLabel(row.is_builtin) }}</span>
        </template>
      </bk-table-column>
      <bk-table-column :label="$t('所属应用')" min-width="120" show-overflow-tooltip>
        <template slot-scope="{ row }">{{ row.app_code || '--' }}</template>
      </bk-table-column>
      <bk-table-column :label="$t('集群内资源名')" prop="resource_name" min-width="170" show-overflow-tooltip />
      <bk-table-column :label="$t('汇总状态')" min-width="150">
        <template slot-scope="{ row }">
          <span :class="['sync-status', statusClass(row.status)]">{{ statusLabel(row.status) }}</span>
        </template>
      </bk-table-column>
      <bk-table-column :label="$t('各集群')" min-width="240">
        <template slot-scope="{ row }">
          <div class="cluster-tags">
            <span
              v-for="(state, index) in states(row)"
              :key="`${state.cluster_name}-${index}`"
              :class="['cluster-tag', statusClass(state.status)]"
              :title="stateTooltip(state)"
            >{{ state.cluster_name }}</span>
            <span
              v-for="cluster in missing(row)"
              :key="`missing-${cluster}`"
              class="cluster-tag missing"
              :title="$t('未下发')"
            >{{ cluster }}</span>
            <span v-if="!states(row).length && !missing(row).length" class="empty-text">
              {{ emptyClusterText(row) }}
            </span>
          </div>
        </template>
      </bk-table-column>
      <bk-table-column :label="$t('操作')" width="90" fixed="right">
        <template slot-scope="{ row }">
          <bk-button
            text
            theme="primary"
            :loading="Boolean(syncingResources[row.resource_name])"
            :disabled="syncDisabled(row)"
            @click="$emit('sync', row)"
          >{{ $t('同步') }}</bk-button>
        </template>
      </bk-table-column>
      <div slot="empty">
        <table-empty
          :condition="filterCondition"
          @clear-filter="clearFilters"
        />
      </div>
    </bk-table>
  </section>
</template>

<script>
import { clampPage } from '@/views/dev-center/app/agent-sandbox/utils';

export default {
  name: 'PlatformSandboxTemplateSyncTable',
  props: {
    templates: { type: Array, default: () => [] },
    syncingResources: { type: Object, default: () => ({}) },
    syncAllLoading: { type: Boolean, default: false },
  },
  data() {
    return { keyword: '', typeFilter: 'all', statusFilter: 'all', page: 1, limit: 10 };
  },
  computed: {
    statusOptions() {
      return ['succeeded', 'pending', 'failed', 'no_cluster'].map(status => ({
        id: status,
        name: this.statusLabel(status === 'no_cluster' ? null : status),
      }));
    },
    filterCondition() {
      return {
        keyword: this.keyword,
        typeFilter: this.typeFilter === 'all' ? '' : this.typeFilter,
        statusFilter: this.statusFilter === 'all' ? '' : this.statusFilter,
      };
    },
    filteredTemplates() {
      const keyword = this.keyword.trim().toLowerCase();
      return this.templates.filter((row) => {
        if (this.typeFilter === 'builtin' && row.is_builtin !== true) return false;
        if (this.typeFilter === 'custom' && row.is_builtin !== false) return false;
        if (this.statusFilter && this.statusFilter !== 'all') {
          // status 为 null 表示没有可下发集群，筛选值单独用 no_cluster。
          const status = row.status === null ? 'no_cluster' : this.statusClass(row.status);
          if (status !== this.statusFilter) return false;
        }
        // 与搜索框文案一致：模板（名称、ID）、所属应用、资源名。
        return !keyword || [row.name, row.template_id, row.app_code, row.resource_name]
          .some(value => String(value || '').toLowerCase()
            .includes(keyword));
      });
    },
    pagedTemplates() {
      const start = (this.page - 1) * this.limit;
      return this.filteredTemplates.slice(start, start + this.limit);
    },
    pagination() {
      return {
        current: this.page,
        limit: this.limit,
        count: this.filteredTemplates.length,
        limitList: [10, 20, 50, 100],
        showTotalCount: true,
      };
    },
  },
  watch: {
    keyword() {
      this.page = 1;
    },
    typeFilter() {
      this.page = 1;
    },
    statusFilter() {
      this.page = 1;
    },
    filteredTemplates() {
      this.page = clampPage(this.page, this.filteredTemplates.length, this.limit);
    },
  },
  methods: {
    typeLabel(isBuiltin) {
      if (isBuiltin === true) return this.$t('内置');
      return isBuiltin === false ? this.$t('自定义') : '--';
    },
    statusClass(status) {
      return ['succeeded', 'pending', 'failed'].includes(status) ? status : 'unknown';
    },
    // 未知状态显示 --，null 表示没有可下发集群。
    statusLabel(status) {
      if (status === null) return this.$t('无可下发集群');
      return {
        succeeded: this.$t('已同步'),
        pending: this.$t('待同步'),
        failed: this.$t('同步失败'),
      }[status] || '--';
    },
    states(row) {
      return row.states || [];
    },
    missing(row) {
      return row.missing || [];
    },
    emptyClusterText(row) {
      if (row.status !== null) return '--';
      // 自定义模板无目标是租户未分配集群，内置模板则是平台没有启用 e2b 集群。
      return row.is_builtin === false ? this.$t('应用租户未分配 e2b 集群') : this.$t('无可下发集群');
    },
    stateTooltip(state) {
      return [this.statusLabel(state.status), state.message, state.updated].filter(Boolean).join('\n');
    },
    // 全量同步进行中、本行同步中、停用、无资源名或无目标集群时不可单行同步。
    syncDisabled(row) {
      return this.syncAllLoading || Boolean(this.syncingResources[row.resource_name])
        || row.enabled !== true || !row.resource_name || row.status === null;
    },
    changeLimit(limit) {
      this.limit = limit;
      this.page = 1;
    },
    clearFilters() {
      this.keyword = '';
      this.typeFilter = 'all';
      this.statusFilter = 'all';
      this.page = 1;
    },
  },
};
</script>

<style lang="scss" scoped>
.sync-table-section {
  min-width: 0;
  padding: 24px;
  background: #fff;
  border-radius: 2px;
  h3 {
    margin: 0;
    color: #313238;
    font-size: 14px;
  }
}
.sync-table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
}
.sync-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.sync-search {
  width: 360px;
  max-width: 100%;
}
.sync-filter {
  width: 160px;
}
.template-name,
.template-id {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.template-heading {
  display: flex;
  align-items: center;
  .template-name { min-width: 0; }
}
.type-tag {
  display: inline-block;
  padding: 1px 6px;
  background: #f0f1f5;
  color: #63656e;
  font-size: 12px;
  line-height: 20px;
  &.builtin { background: #eaf3ff; color: #3a84ff; }
}
.sync-table {
  /deep/ .bk-table-row,
  /deep/ .bk-table-row td {
    height: 56px;
  }
  /deep/ .bk-table-row td .cell {
    padding-top: 0;
    padding-bottom: 0;
    line-height: 20px;
  }
}
.template-name {
  color: #313238;
  line-height: 20px;
}
.template-id,
.empty-text {
  color: #979ba5;
  font-size: 12px;
  line-height: 20px;
}
.sync-status {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  &::before {
    width: 8px;
    height: 8px;
    margin-right: 6px;
    background: #979ba5;
    border-radius: 50%;
    content: '';
  }
  &.succeeded::before { background: #2dcb56; }
  &.pending::before { background: #ff9c01; }
  &.failed::before { background: #ea3636; }
}
.disabled-tag {
  display: inline-block;
  flex-shrink: 0;
  margin-left: 6px;
  padding: 0 5px;
  background: #f0f1f5;
  color: #979ba5;
  font-size: 12px;
  line-height: 20px;
}
.cluster-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.cluster-tag {
  max-width: 100%;
  padding: 1px 6px;
  background: #f0f1f5;
  border-radius: 2px;
  color: #63656e;
  font-size: 12px;
  line-height: 20px;
  overflow-wrap: anywhere;
  &.succeeded { background: #e5f6ea; color: #299e56; }
  &.pending { background: #fff1db; color: #b87300; }
  &.failed { background: #ffebeb; color: #c52a2a; }
}
</style>
