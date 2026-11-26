<template>
  <div v-bkloading="{ isLoading: loading, zIndex: 10 }" class="sandbox-overview">
    <section class="overview-section">
      <div class="section-header">
        <h3>{{ $t('整体健康度') }}</h3>
        <bk-button
          theme="primary"
          outline
          :loading="syncAllLoading"
          :disabled="loading || !hasSyncTargets || hasScopedSync"
          @click="syncAll"
        >{{ $t('全量同步') }}</bk-button>
      </div>
      <bk-alert v-if="alertType" :type="alertType" :title="alertMessage" class="sync-alert" />
      <div class="overview-metrics">
        <div class="metric-item">
          <div class="metric-label">{{ $t('启用 e2b 的集群') }}</div>
          <div class="metric-value">
            <span>{{ completedClusters }} / {{ clusters.length }}</span><small>{{ $t('已完成') }}</small>
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">{{ $t('模板总数') }}</div>
          <div class="metric-value">{{ templates.length }}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">{{ $t('同步失败') }}</div>
          <div class="metric-value failed">{{ healthCounts.failed }}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">{{ $t('待同步') }}</div>
          <div class="metric-value pending">{{ healthCounts.pending }}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">{{ $t('无可下发集群') }}</div>
          <div class="metric-value muted">{{ healthCounts.noCluster }}</div>
        </div>
      </div>
    </section>
    <section class="overview-section cluster-section">
      <div class="section-header"><h3>{{ $t('按集群') }}</h3></div>
      <div v-if="clusters.length" class="cluster-grid">
        <article v-for="cluster in clusters" :key="cluster.cluster_name" class="cluster-card">
          <div class="cluster-header">
            <router-link :to="clusterLink(cluster)" class="cluster-name" :title="cluster.cluster_name">
              {{ cluster.cluster_name }}
            </router-link>
            <span :class="['completion-tag', { completed: cluster.completed === true }]">
              {{ cluster.completed === true ? $t('已完成') : $t('未完成') }}
            </span>
          </div>
          <p class="namespace">{{ $t('命名空间') }}：{{ cluster.namespace || '--' }}</p>
          <div class="cluster-counts">
            <div class="succeeded" :class="{ empty: !arrayCount(cluster.succeeded) }">
              <strong>{{ arrayCount(cluster.succeeded) }}</strong><span>{{ $t('成功') }}</span>
            </div>
            <div class="pending" :class="{ empty: !arrayCount(cluster.pending) }">
              <strong>{{ arrayCount(cluster.pending) }}</strong><span>{{ $t('待同步') }}</span>
            </div>
            <div class="failed" :class="{ empty: !failureCount(cluster) }">
              <strong>{{ failureCount(cluster) }}</strong><span>{{ $t('失败') }}</span>
            </div>
            <div class="missing"><strong>{{ arrayCount(cluster.missing) }}</strong><span>{{ $t('未下发') }}</span></div>
          </div>
          <div v-if="cluster.completed !== true" class="cluster-footer">
            <div class="cluster-actions">
              <bk-button
                text
                theme="primary"
                class="cluster-toggle"
                :aria-expanded="Boolean(expandedClusters[cluster.cluster_name])"
                :disabled="!clusterIssues(cluster).length"
                @click="toggleCluster(cluster.cluster_name)"
              >
                <i
                  class="paasng-icon"
                  :class="['paasng-right-shape', { 'is-open': expandedClusters[cluster.cluster_name] }]"
                />
                {{ $t('查看未完成的模板') }}
              </bk-button>
              <bk-button
                text
                theme="primary"
                :loading="Boolean(syncingClusters[cluster.cluster_name])"
                :disabled="syncAllLoading || !enabledTemplates.length || Boolean(syncingClusters[cluster.cluster_name])"
                @click="syncCluster(cluster)"
              >{{ $t('同步') }}</bk-button>
            </div>
            <div v-if="expandedClusters[cluster.cluster_name]" class="cluster-issues">
              <div
                v-for="item in clusterIssues(cluster)"
                :key="`${item.status}-${item.resourceName}`"
                class="cluster-issue"
              >
                <div class="issue-heading">
                  <span :class="['issue-dot', item.status]"></span>
                  <span class="issue-name" :title="item.resourceName">{{ issueName(item.resourceName) }}</span>
                  <span
                    class="issue-status"
                    :class="{ 'has-message': Boolean(item.message) }"
                    :title="item.message || issueLabel(item.status)"
                  >
                    {{ issueLabel(item.status) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
      <div v-else class="cluster-empty">{{ $t('暂无启用 e2b 的集群') }}</div>
    </section>
    <template-sync-table
      :templates="templates"
      :syncing-resources="syncingResources"
      :sync-all-loading="syncAllLoading"
      @sync="syncTemplate"
    />
  </div>
</template>

<script>
import TemplateSyncTable from './comps/template-sync-table.vue';

export default {
  name: 'PlatformSandboxOverview',
  components: { TemplateSyncTable },
  data() {
    return {
      templates: [],
      clusters: [],
      loading: false,
      pollTimer: null,
      syncAllLoading: false,
      syncingClusters: {},
      syncingResources: {},
      expandedClusters: {},
    };
  },
  computed: {
    // 健康度、轮询和同步都不计入停用模板。
    enabledTemplates() {
      return this.templates.filter(row => row.enabled === true);
    },
    completedClusters() {
      return this.clusters.filter(cluster => cluster.completed === true).length;
    },
    healthCounts() {
      return {
        failed: this.enabledTemplates.filter(row => row.status === 'failed').length,
        pending: this.enabledTemplates.filter(row => row.status === 'pending').length,
        noCluster: this.enabledTemplates.filter(row => row.status === null).length,
      };
    },
    // 没有启用集群，或启用模板都没有下发目标时，不能全量同步。
    hasSyncTargets() {
      return this.enabledTemplates.some(row => row.status !== null && row.resource_name) && this.clusters.length > 0;
    },
    hasScopedSync() {
      return Object.keys(this.syncingClusters).length > 0 || Object.keys(this.syncingResources).length > 0;
    },
    // 集群未完成或存在失败用红色；仅待同步或无目标时用橙色。
    alertType() {
      if (this.healthCounts.failed || this.completedClusters < this.clusters.length) return 'error';
      return this.healthCounts.pending || this.healthCounts.noCluster ? 'warning' : '';
    },
    alertMessage() {
      const messages = [];
      const incompleteClusters = this.clusters.length - this.completedClusters;
      if (incompleteClusters) messages.push(this.$t('{count} 个集群未完成', { count: incompleteClusters }));
      if (this.healthCounts.failed) {
        messages.push(this.$t('{count} 个模板同步失败', { count: this.healthCounts.failed }));
      }
      if (this.healthCounts.pending) {
        messages.push(this.$t('{count} 个模板待同步', { count: this.healthCounts.pending }));
      }
      if (this.healthCounts.noCluster) {
        messages.push(this.$t('{count} 个模板无可下发集群', { count: this.healthCounts.noCluster }));
      }
      return messages.join('；');
    },
  },
  created() {
    this.loadData();
  },
  mounted() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  },
  beforeDestroy() {
    this.stopPolling();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  },
  methods: {
    // 拉取模板与集群同步状态；静默刷新不展示整页加载。
    async loadData(silent = false) {
      this.stopPolling();
      if (!silent) this.loading = true;
      try {
        const [templates, clusters] = await Promise.all([
          this.$store.dispatch('tenantConfig/getAgentSandboxTemplateSyncStatus'),
          this.$store.dispatch('tenantConfig/getAgentSandboxClusterSyncStatus'),
        ]);
        this.templates = templates;
        this.clusters = clusters;
        this.schedulePolling();
      } catch (error) {
        this.catchErrorHandler(error);
      } finally {
        this.loading = false;
      }
    },
    stopPolling() {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    },
    // 页面可见且仍有启用模板待同步时，5 秒后再静默刷新。
    schedulePolling() {
      this.stopPolling();
      // 组件销毁后，在途响应不再安排下一轮轮询。
      // eslint-disable-next-line no-underscore-dangle
      if (this._isDestroyed || document.hidden || !this.enabledTemplates.some(row => row.status === 'pending')) return;
      this.pollTimer = setTimeout(() => this.loadData(true), 5000);
    },
    // 切走只停轮询。切回不重新请求，有待同步项时再按间隔继续。
    handleVisibilityChange() {
      if (document.hidden) this.stopPolling();
      else this.schedulePolling();
    },
    arrayCount(value) {
      return (value || []).length;
    },
    failureCount(cluster) {
      return Object.keys(cluster.failed || {}).length;
    },
    // 把失败、待同步和未下发合成可展开的列表。
    clusterIssues(cluster) {
      const failed = cluster.failed || {};
      const pending = cluster.pending || [];
      const missing = cluster.missing || [];
      return [
        ...Object.entries(failed).map(([resourceName, message]) => ({ resourceName, status: 'failed', message })),
        ...pending.map(resourceName => ({ resourceName, status: 'pending' })),
        ...missing.map(resourceName => ({ resourceName, status: 'missing' })),
      ];
    },
    issueLabel(status) {
      return { failed: this.$t('失败'), pending: this.$t('待同步'), missing: this.$t('未下发') }[status];
    },
    // 自定义模板带上所属应用，找不到模板时退回资源名。
    issueName(resourceName) {
      const template = this.templates.find(row => row.resource_name === resourceName);
      if (!template || !template.template_id) return resourceName;
      return template.app_code ? `${template.app_code} / ${template.template_id}` : template.template_id;
    },
    toggleCluster(clusterName) {
      this.$set(this.expandedClusters, clusterName, !this.expandedClusters[clusterName]);
    },
    clusterLink(cluster) {
      // 链接到集群详情的 e2b 页签。
      return {
        name: 'platformAppCluster',
        query: { active: 'list', type: 'detail', cluster: cluster.cluster_name, tab: 'e2b' },
      };
    },
    syncAll() {
      if (this.syncAllLoading || this.hasScopedSync || !this.hasSyncTargets) return;
      return this.submitSync('all', '', {});
    },
    syncCluster(cluster) {
      if (this.syncAllLoading || this.syncingClusters[cluster.cluster_name] || !this.enabledTemplates.length) return;
      return this.submitSync('cluster', cluster.cluster_name, { cluster_names: [cluster.cluster_name] });
    },
    // 停用、无资源名或没有下发目标的模板不能单独同步。
    syncTemplate(row) {
      if (this.syncAllLoading || this.syncingResources[row.resource_name]
        || row.enabled !== true || row.status === null || !row.resource_name) return;
      return this.submitSync('resource', row.resource_name, { resource_names: [row.resource_name] });
    },
    // 按全量、集群或模板加锁后提交同步，结束后重新拉取。
    async submitSync(scope, key, data) {
      if (scope === 'all') this.syncAllLoading = true;
      else this.$set(scope === 'cluster' ? this.syncingClusters : this.syncingResources, key, true);
      try {
        await this.$store.dispatch('tenantConfig/syncAgentSandboxTemplates', { data });
        // 只表示请求已受理，不表示集群下发完成。
        this.$paasMessage({ theme: 'success', message: this.$t('同步请求已提交') });
        await this.loadData();
      } catch (error) {
        this.catchErrorHandler(error);
      } finally {
        if (scope === 'all') this.syncAllLoading = false;
        else this.$delete(scope === 'cluster' ? this.syncingClusters : this.syncingResources, key);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.sandbox-overview {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.overview-section {
  padding: 20px 24px;
  background: #fff;
  border-radius: 2px;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  h3 {
    margin: 0;
    color: #313238;
    font-size: 14px;
  }
}
.overview-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  padding-top: 4px;
}
.metric-item {
  padding: 0 24px;
  text-align: left;
  border-right: 1px solid #eaebf0;
  &:first-child { padding-left: 0; }
  &:last-child { border: 0; }
}
.metric-value {
  color: #313238;
  font-size: 24px;
  font-weight: 700;
  line-height: 30px;
  small {
    margin-left: 6px;
    color: #63656e;
    font-size: 12px;
    font-weight: 400;
  }
  &.failed { color: #ea3636; }
  &.pending { color: #ff9c01; }
  &.muted { color: #979ba5; }
}
.metric-label {
  margin-bottom: 6px;
  color: #979ba5;
  font-size: 12px;
  line-height: 18px;
}
.sync-alert { margin-bottom: 16px; }
.cluster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(256px, 1fr));
  gap: 16px;
  align-items: stretch;
}
.cluster-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px 20px;
  border: 1px solid #eaebf0;
  border-radius: 2px;
}
.cluster-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.cluster-name {
  overflow: hidden;
  color: #3a84ff;
  font-size: 14px;
  font-weight: 700;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
  &:hover { color: #699df4; }
}
.completion-tag {
  flex-shrink: 0;
  padding: 0 10px;
  background: rgba(254, 156, 0, 0.1);
  border-radius: 2px;
  color: #fe9c00;
  font-size: 12px;
  line-height: 22px;
  &.completed { background: rgba(20, 165, 104, 0.1); color: #14a568; }
}
.namespace {
  margin: 4px 0 0;
  color: #979ba5;
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.cluster-counts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin-top: 16px;
  padding: 10px 8px;
  background: #fafbfd;
  border-radius: 2px;
  div { display: flex; flex-direction: column; align-items: center; }
  strong { color: #979ba5; font-size: 18px; font-weight: 700; line-height: 24px; }
  span { margin-top: 2px; color: #979ba5; font-size: 12px; line-height: 18px; }
  .succeeded:not(.empty) strong { color: #2dcb56; }
  .pending:not(.empty) strong { color: #ff9c01; }
  .failed:not(.empty) strong { color: #ea3636; }
}
.cluster-footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #eaebf0;
}
.cluster-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 22px;
  /deep/ .bk-button-text { height: 20px; padding: 0; font-size: 12px; line-height: 20px; }
  /deep/ .cluster-toggle.bk-button-text {
    color: #63656e;
    &:not(:disabled):hover { color: #3a84ff; }
    .paasng-icon {
      display: inline-block;
      margin-right: 4px;
      color: #979ba5;
      font-size: 12px;
      transition: transform 0.2s;
      &.is-open { transform: rotate(90deg); }
    }
  }
}
.cluster-issues {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 2px;
}
.issue-heading {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  line-height: 22px;
}
.issue-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  background: #c4c6cc;
  border-radius: 50%;
  &.failed { background: #ea3636; }
  &.pending { background: #ff9c01; }
}
.issue-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #313238;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.issue-status {
  flex-shrink: 0;
  color: #63656e;
  font-size: 12px;
  &.has-message { border-bottom: 1px dashed #979ba5; cursor: help; }
}
.cluster-empty { padding: 32px 0; color: #979ba5; text-align: center; }
@media (max-width: 1100px) {
  .metric-item { padding: 8px; }
  .metric-value { font-size: 24px; }
}
</style>
