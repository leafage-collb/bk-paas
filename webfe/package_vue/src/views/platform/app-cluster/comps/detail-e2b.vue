<template>
  <div v-bkloading="{ isLoading: loading, zIndex: 10 }" class="cluster-detail-e2b">
    <div v-if="config === null && !loading" class="e2b-empty">
      <bk-exception type="empty" scene="part">
        <div class="empty-title">{{ $t('该集群尚未接入 e2b 沙箱') }}</div>
        <p class="empty-description">{{ $t('接入后，应用可以通过 e2b SDK 在该集群上创建 Agent 沙箱。') }}</p>
        <bk-button theme="primary" @click="openEditor">{{ $t('接入 e2b 沙箱') }}</bk-button>
      </bk-exception>
    </div>
    <template v-if="config">
      <section class="config-section">
        <div class="section-header">
          <h3>{{ $t('接入配置') }}</h3>
          <div class="config-actions">
            <bk-button theme="primary" outline :disabled="loading || operationLoading" @click="openEditor">
              {{ $t('编辑') }}
            </bk-button>
            <bk-dropdown-menu ref="more" trigger="click" align="right">
              <bk-button
                slot="dropdown-trigger"
                class="more-trigger"
                :disabled="loading || operationLoading"
                :aria-label="$t('更多')"
              >
                <i class="bk-icon icon-more"></i>
              </bk-button>
              <ul slot="dropdown-content" class="bk-dropdown-list e2b-menu">
                <li>
                  <button type="button" :disabled="operationLoading" @click="confirmToggle">
                    {{ config.enabled ? $t('停用') : $t('启用') }}
                  </button>
                </li>
                <li v-bk-tooltips="{ content: deleteTip, disabled: !deleteTip }">
                  <button type="button" :disabled="operationLoading || !canDelete" @click="confirmDelete">
                    {{ $t('删除') }}
                  </button>
                </li>
              </ul>
            </bk-dropdown-menu>
          </div>
        </div>
        <details-row :label="`${$t('状态')}：`" :label-width="labelWidth">
          <template slot="value">
            <span :class="['enabled-state', { enabled: config.enabled }]">
              {{ config.enabled ? $t('已启用') : $t('已停用') }}
            </span>
          </template>
        </details-row>
        <details-row :label-width="labelWidth" is-full>
          <template slot="label">
            {{ $t('控制面地址') }}
            <i class="paasng-icon paasng-info-line" v-bk-tooltips="controlPlaneTip"></i>：
          </template>
          <template slot="value">{{ config.control_plane_url }}</template>
        </details-row>
        <details-row :label-width="labelWidth" is-full>
          <template slot="label">
            {{ $t('数据面地址') }}
            <i class="paasng-icon paasng-info-line" v-bk-tooltips="dataPlaneTip"></i>：
          </template>
          <template slot="value">{{ config.data_plane_address }}</template>
        </details-row>
        <details-row :label-width="labelWidth">
          <template slot="label">
            {{ $t('命名空间') }}
            <i class="paasng-icon paasng-info-line" v-bk-tooltips="namespaceTip"></i>：
          </template>
          <template slot="value">{{ config.namespace || '--' }}</template>
        </details-row>
        <details-row label="API Key：" :label-width="labelWidth">
          <template slot="value">
            <span class="sensitive-key" aria-label="••••••"><span v-for="dot in 6" :key="dot" /></span>
          </template>
        </details-row>
        <details-row :label="`${$t('存量沙箱')}：`" :label-width="labelWidth">
          <template slot="value">{{ config.live_sandbox_count ?? '--' }}</template>
        </details-row>
      </section>
      <section v-if="config.enabled" v-bkloading="{ isLoading: syncLoading, zIndex: 10 }" class="sync-section">
        <div class="section-header">
          <h3>
            {{ $t('模板下发') }}
            <i class="paasng-icon paasng-info-line" v-bk-tooltips="syncScopeTip"></i>
            <span v-if="syncStatus" :class="['completion-tag', { completed: syncStatus.completed }]">
              {{ syncStatus.completed ? $t('已完成') : $t('未完成') }}
            </span>
          </h3>
          <bk-button
            theme="primary"
            outline
            :loading="syncSubmitting"
            :disabled="loading || syncLoading || operationLoading"
            v-bk-tooltips="$t('保存配置后平台不会自动下发，点击后补齐本集群缺失或失败的模板')"
            @click="syncTemplates"
          >{{ $t('同步') }}</bk-button>
        </div>
        <div class="sync-counts">
          <div v-for="item in syncCounts" :key="item.status" :class="['sync-count', item.status]">
            <strong :class="{ empty: item.count === 0 }">{{ item.count }}</strong><span>{{ item.label }}</span>
          </div>
        </div>
        <p class="overview-link">
          <router-link :to="{ name: 'platformAgentSandbox', query: { active: 'overview' } }">
            {{ $t('在 Agent 沙箱概览查看全部集群') }}
            <i class="paasng-icon paasng-jump-link"></i>
          </router-link>
        </p>
        <bk-table v-if="issueRows.length" :data="issueRows" size="small" :dark-header="true" class="issue-table">
          <bk-table-column :label="$t('资源名')" prop="resourceName" min-width="220" show-overflow-tooltip />
          <bk-table-column :label="$t('状态')" width="110">
            <template slot-scope="{ row }">
              <span :class="['issue-status', row.status]">{{ row.label }}</span>
            </template>
          </bk-table-column>
          <bk-table-column :label="$t('原因')" prop="message" min-width="260" show-overflow-tooltip />
        </bk-table>
      </section>
    </template>
    <e2b-config-sideslider ref="editor" :cluster-name="clusterName" :config="config || null" @saved="handleSaved" />
  </div>
</template>

<script>
/*
 * TencentBlueKing is pleased to support the open source community by making
 * 蓝鲸智云 - PaaS 平台 (BlueKing - PaaS System) available.
 * Copyright (C) Tencent. All rights reserved.
 * Licensed under the MIT License (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 *     http://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied. See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * We undertake not to change the open source license (MIT license) applicable
 * to the current version of the project delivered to anyone in the future.
 */
import DetailsRow from '@/components/details-row';
import E2bConfigSideslider from './e2b-config-sideslider.vue';

export default {
  name: 'DetailE2b',
  components: { DetailsRow, E2bConfigSideslider },
  props: {
    clusterName: { type: String, required: true },
  },
  data() {
    return {
      config: undefined,
      loading: false,
      operationLoading: false,
      syncStatus: null,
      syncLoading: false,
      syncSubmitting: false,
      pollTimer: null,
    };
  },
  computed: {
    labelWidth() {
      return this.$store.state.localLanguage === 'en' ? 170 : 100;
    },
    controlPlaneTip() {
      return {
        content: this.$t('apiserver 调用 e2b-gateway 创建、销毁沙箱的地址，不对用户暴露'),
        width: 260,
      };
    },
    dataPlaneTip() {
      const address = this.config?.data_plane_address || 'e2b.example.com';
      return {
        content: `${this.$t('SDK 直连沙箱执行命令、读写文件，示例：')}49983-i8f2k1x0.${address}`,
        width: 300,
      };
    },
    namespaceTip() {
      return {
        content: this.$t('模板下发到这个命名空间，创建后不可修改'),
        width: 240,
      };
    },
    syncScopeTip() {
      return {
        content: this.$t('内置模板下发到所有启用 e2b 的集群；应用的自定义模板只下发到应用租户可分配的集群。'),
        width: 280,
      };
    },
    canDelete() {
      return this.config?.live_sandbox_count === 0;
    },
    deleteTip() {
      return this.config?.live_sandbox_count > 0
        ? this.$t('集群上还有 {count} 个存量沙箱，删除会被拒绝。建议先停用，待存量沙箱全部销毁后再删除', {
          count: this.config.live_sandbox_count,
        }) : '';
    },
    syncCounts() {
      return [
        { status: 'succeeded', label: this.$t('成功'), count: this.syncStatus?.succeeded.length ?? '--' },
        { status: 'pending', label: this.$t('待同步'), count: this.syncStatus?.pending.length ?? '--' },
        { status: 'failed', label: this.$t('失败'), count: this.syncStatus ? Object.keys(this.syncStatus.failed).length : '--' },
        { status: 'missing', label: this.$t('未下发'), count: this.syncStatus?.missing.length ?? '--' },
      ];
    },
    issueRows() {
      if (!this.syncStatus) return [];
      return [
        ...Object.entries(this.syncStatus.failed).map(([resourceName, message]) => ({
          resourceName, message, status: 'failed', label: this.$t('同步失败'),
        })),
        ...this.syncStatus.pending.map(resourceName => ({
          resourceName, message: '--', status: 'pending', label: this.$t('待同步'),
        })),
        ...this.syncStatus.missing.map(resourceName => ({
          resourceName, message: this.$t('还没有下发过，需同步补齐'), status: 'missing', label: this.$t('未下发'),
        })),
      ];
    },
  },
  created() {
    // BK Info 实例只作为弹窗句柄保存，不放入响应式表单数据。
    this.operationDialog = null;
  },
  mounted() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  },
  activated() {
    this.loadConfig();
  },
  deactivated() {
    this.stopPolling();
    this.closeOperationDialog();
  },
  beforeDestroy() {
    this.stopPolling();
    this.closeOperationDialog();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  },
  methods: {
    async beforeLeave() {
      if (this.operationLoading) return false;
      const canLeave = await this.$refs.editor.handleBeforeClose();
      if (canLeave) this.closeOperationDialog();
      return canLeave;
    },
    showOperationDialog(options) {
      this.operationDialog = this.$bkInfo({
        ...options,
        afterLeaveFn: () => {
          this.operationDialog = null;
        },
      });
      this.operationDialog.beforeClose = () => !this.operationLoading;
    },
    closeOperationDialog() {
      if (!this.operationDialog) return;
      // 销毁时也要清理挂在 body 上的确认框。
      this.operationDialog.beforeClose = null;
      this.operationDialog.close();
      this.operationDialog = null;
    },
    // 父级按集群重建详情组件，已确认集群存在后，配置 404 才表示尚未接入。
    async loadConfig() {
      this.stopPolling();
      this.loading = true;
      try {
        this.config = await this.$store.dispatch('tenant/getClusterE2bConfig', { clusterName: this.clusterName });
        if (this.config.enabled) await this.loadSyncStatus();
        else {
          this.stopPolling();
          this.syncStatus = null;
        }
      } catch (error) {
        if (error.status === 404) {
          this.config = null;
          this.syncStatus = null;
        } else this.catchErrorHandler(error);
      } finally {
        this.loading = false;
      }
    },
    openEditor() {
      if (this.config === undefined) return;
      this.$refs.editor.open();
    },
    async handleSaved({ enabled }) {
      this.$emit('config-change', { clusterName: this.clusterName, enabled });
      await this.loadConfig();
    },
    confirmToggle() {
      this.$refs.more.hide();
      if (this.operationDialog || !this.config) return;
      const enabled = !this.config.enabled;
      this.showOperationDialog({
        type: 'warning',
        width: 480,
        title: enabled ? this.$t('启用该集群的 e2b 沙箱？') : this.$t('停用该集群的 e2b 沙箱？'),
        subTitle: enabled
          ? this.$t('停用期间修改过的模板不会自动补齐，启用后请点击「同步」')
          : this.$t('新沙箱不再调度到该集群，也不再接收模板下发；存量沙箱仍可续期和销毁。'),
        okText: enabled ? this.$t('启用') : this.$t('停用'),
        confirmLoading: true,
        confirmFn: async () => {
          if (this.operationLoading) return false;
          this.operationLoading = true;
          try {
            await this.$store.dispatch('tenant/updateClusterE2bConfig', {
              clusterName: this.clusterName,
              data: {
                control_plane_url: this.config.control_plane_url,
                data_plane_address: this.config.data_plane_address,
                namespace: this.config.namespace,
                enabled,
              },
            });
            this.$emit('config-change', { clusterName: this.clusterName, enabled });
            await this.loadConfig();
            return true;
          } catch (error) {
            this.catchErrorHandler(error);
            return false;
          } finally {
            this.operationLoading = false;
          }
        },
      });
    },
    confirmDelete() {
      this.$refs.more.hide();
      if (this.operationDialog || !this.canDelete) return;
      this.showOperationDialog({
        type: 'warning',
        width: 480,
        title: this.$t('删除该集群的 e2b 接入配置？'),
        subTitle: this.$t('删除后该集群的模板下发记录会一并清除，集群里已下发的模板资源需手动清理。'),
        okText: this.$t('删除'),
        confirmLoading: true,
        confirmFn: async () => {
          if (this.operationLoading) return false;
          this.operationLoading = true;
          try {
            await this.$store.dispatch('tenant/deleteClusterE2bConfig', { clusterName: this.clusterName });
            this.stopPolling();
            this.config = null;
            this.syncStatus = null;
            this.$emit('config-change', { clusterName: this.clusterName, enabled: null });
            return true;
          } catch (error) {
            this.catchErrorHandler(error);
            return false;
          } finally {
            this.operationLoading = false;
          }
        },
      });
    },
    async loadSyncStatus() {
      if (this.syncLoading || !this.config?.enabled) return;
      this.stopPolling();
      this.syncLoading = true;
      try {
        const clusters = await this.$store.dispatch('tenantConfig/getAgentSandboxClusterSyncStatus');
        this.syncStatus = clusters.find(cluster => cluster.cluster_name === this.clusterName) || null;
      } catch (error) {
        this.stopPolling();
        this.catchErrorHandler(error);
        return;
      } finally {
        this.syncLoading = false;
      }
      this.schedulePolling();
    },
    async syncTemplates() {
      if (this.syncSubmitting || !this.config?.enabled) return;
      this.stopPolling();
      this.syncSubmitting = true;
      try {
        await this.$store.dispatch('tenantConfig/syncAgentSandboxTemplates', {
          data: { cluster_names: [this.clusterName] },
        });
        this.$paasMessage({ theme: 'success', message: this.$t('同步请求已提交') });
        this.syncSubmitting = false;
        await this.loadSyncStatus();
      } catch (error) {
        this.stopPolling();
        this.catchErrorHandler(error);
      } finally {
        this.syncSubmitting = false;
      }
    },
    stopPolling() {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    },
    schedulePolling() {
      this.stopPolling();
      if (document.hidden || !this.config?.enabled || !this.syncStatus?.pending.length) return;
      this.pollTimer = setTimeout(() => this.loadSyncStatus(), 5000);
    },
    handleVisibilityChange() {
      if (document.hidden) this.stopPolling();
      else this.schedulePolling();
    },
  },
};
</script>

<style lang="scss" scoped>
.cluster-detail-e2b {
  min-height: 320px;
  color: #63656e;
}
.e2b-empty {
  text-align: center;
  .empty-title {
    color: #313238;
    font-size: 14px;
  }
  .empty-description {
    margin: 8px 0 16px;
    color: #979ba5;
    font-size: 12px;
  }
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 32px;
  margin: 24px 0 12px;
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: #313238;
    font-size: 14px;
    line-height: 22px;
  }
}
.config-actions {
  display: flex;
  gap: 8px;
}
.config-section > .section-header {
  position: relative;
  min-height: 22px;
  .config-actions {
    position: absolute;
    top: 0;
    right: 0;
  }
}
.more-trigger {
  min-width: 32px;
  padding: 0;
}
.sensitive-key {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  vertical-align: middle;
  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4d4f56;
  }
}
.paasng-info-line {
  color: #979ba5;
  cursor: pointer;
  font-size: 14px;
  font-weight: normal;
}
.enabled-state::before {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 8px;
  background: #c4c6cc;
  border-radius: 50%;
  content: '';
}
.enabled-state.enabled::before {
  background: #2dcb56;
}
.e2b-menu {
  min-width: 56px;
}
.e2b-menu button {
  width: 100%;
  padding: 0 16px;
  color: #63656e;
  text-align: left;
  white-space: nowrap;
  font-size: 12px;
  line-height: 32px;
  background: transparent;
  border: 0;
  cursor: pointer;
  &:hover {
    color: #3a84ff;
    background: #eaf3ff;
  }
  &:disabled {
    color: #c4c6cc;
    cursor: not-allowed;
  }
}
.sync-section {
  margin-top: 24px;
}
.completion-tag {
  padding: 2px 8px;
  color: #b76a00;
  font-size: 12px;
  font-weight: normal;
  background: #fff3e1;
  border-radius: 2px;
  &.completed {
    color: #14a568;
    background: #e4faf0;
  }
}
.sync-counts {
  display: flex;
  width: 100%;
  padding: 10px 0;
  background: #fafbfd;
}
.sync-count {
  display: flex;
  flex: 0 0 120px;
  flex-direction: column;
  gap: 2px;
  width: 120px;
  text-align: center;
  strong {
    font-size: 18px;
    line-height: 24px;
    font-weight: 700;
    &.empty {
      color: #979ba5;
    }
  }
  span {
    color: #979ba5;
    font-size: 12px;
    line-height: 18px;
  }
}
.succeeded {
  color: #2dcb56;
}
.pending {
  color: #ff9c01;
}
.failed {
  color: #ea3636;
}
.missing {
  color: #979ba5;
}
.overview-link {
  margin: 8px 0 16px;
  font-size: 12px;
  a {
    color: #3a84ff;
  }
}
.issue-status::before {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  background: #979ba5;
  border-radius: 50%;
  content: '';
}
.issue-status {
  color: #63656e;
  &.failed::before {
    background: #ea3636;
  }
  &.pending::before {
    background: #ff9c01;
  }
}
</style>
