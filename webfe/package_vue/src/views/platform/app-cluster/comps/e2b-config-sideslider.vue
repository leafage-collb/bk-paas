<template>
  <bk-sideslider
    :is-show.sync="visible"
    :width="800"
    :title="isEdit ? $t('编辑 e2b 沙箱') : $t('接入 e2b 沙箱')"
    :quick-close="true"
    :before-close="handleBeforeClose"
    show-mask
    ext-cls="cluster-e2b-config-editor"
  >
    <div slot="header" class="editor-header">
      <span>{{ isEdit ? $t('编辑 e2b 沙箱') : $t('接入 e2b 沙箱') }}</span>
      <span class="cluster-name" :title="clusterName">{{ clusterName }}</span>
    </div>
    <div slot="content" class="editor-content">
      <bk-alert v-if="!isEdit" type="info" class="access-notice">
        <template slot="title">
          <span>{{ $t('接入前请确认：') }}</span>
          <ol>
            <li>{{ $t('集群内已部署 e2b-gateway（控制面）与 e2b-sandbox-gateway（数据面）') }}</li>
            <li>{{ $t('数据面域名已配置泛解析与通配证书：SDK 会直连 <端口>-<沙箱ID>.<数据面地址>') }}</li>
            <li>{{ $t('集群已安装存储类 cbs（挂载独立系统盘的模板需要）') }}</li>
          </ol>
        </template>
      </bk-alert>
      <bk-form
        v-if="visible"
        ref="form"
        :model="formData"
        :rules="rules"
        :label-width="labelWidth"
        class="e2b-config-form"
      >
        <h3 class="group-title">{{ $t('控制面') }}</h3>
        <bk-form-item :label="$t('控制面地址')" property="control_plane_url" required>
          <bk-input
            v-model="formData.control_plane_url"
            placeholder="http://e2b-gateway.bcs-system:8080"
            :maxlength="256"
            :disabled="submitting"
          />
          <p class="field-hint">{{ $t('apiserver 访问 e2b-gateway 的地址，以 http:// 或 https:// 开头') }}</p>
        </bk-form-item>
        <bk-form-item label="API Key" property="api_key" :required="!isEdit">
          <div :class="['api-key-input', { 'masked-key': isEdit && !editingKey, 'editing-key': isEdit && editingKey }]">
            <bk-input
              :value="isEdit && !editingKey ? '••••••' : formData.api_key"
              type="password"
              :password-icon="[]"
              :placeholder="$t('e2b-gateway 的凭证，如 e2b_xxxx')"
              :disabled="submitting"
              @focus="editKey"
              @input="formData.api_key = $event"
            />
            <bk-button
              v-if="isEdit && editingKey"
              theme="primary"
              text
              :disabled="submitting"
              :aria-label="$t('恢复原值')"
              v-bk-tooltips="$t('恢复原值')"
              class="restore-key"
              @click="restoreKey"
            >
              <i class="paasng-icon paasng-undo" />
            </bk-button>
          </div>
          <p class="field-hint">{{ $t('仅 apiserver 持有，加密保存，不会下发给用户') }}</p>
        </bk-form-item>
        <bk-form-item :label="$t('命名空间')" property="namespace" :required="!isEdit">
          <bk-input v-model="formData.namespace" placeholder="default" :disabled="isEdit || submitting" />
          <p class="field-hint">{{ $t('须与 API Key 绑定的命名空间一致，创建后不可修改') }}</p>
        </bk-form-item>
        <h3 class="group-title">{{ $t('数据面') }}</h3>
        <bk-form-item :label="$t('数据面地址')" property="data_plane_address" required>
          <bk-input
            v-model="formData.data_plane_address"
            placeholder="e2b.example.com"
            :maxlength="256"
            :disabled="submitting"
          />
          <p class="field-hint">{{ $t('SDK 实际访问：{address}', { address: sdkAddress }) }}</p>
        </bk-form-item>
        <h3 class="group-title">{{ $t('调度') }}</h3>
        <bk-form-item :label="$t('启用')">
          <bk-switcher v-model="formData.enabled" theme="primary" :disabled="submitting" />
          <p class="field-hint">{{ $t('停用后新沙箱不再调度到该集群，存量沙箱不受影响') }}</p>
        </bk-form-item>
      </bk-form>
    </div>
    <div slot="footer" class="editor-footer">
      <bk-button theme="primary" :loading="submitting" @click="save">
        {{ isEdit ? $t('保存') : $t('接入') }}
      </bk-button>
      <bk-button :disabled="submitting" @click="close">{{ $t('取消') }}</bk-button>
    </div>
  </bk-sideslider>
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

import sidebarDiffMixin from '@/mixins/sidebar-diff-mixin';

export default {
  name: 'ClusterE2bConfigSideslider',
  mixins: [sidebarDiffMixin],
  props: {
    clusterName: { type: String, required: true },
    config: { type: Object, default: null },
  },
  data() {
    return {
      visible: false,
      submitting: false,
      editingKey: false,
      formData: {
        control_plane_url: '',
        data_plane_address: '',
        namespace: 'default',
        enabled: true,
        api_key: '',
      },
    };
  },
  computed: {
    isEdit() {
      return this.config !== null;
    },
    labelWidth() {
      return this.$store.state.localLanguage === 'en' ? 170 : 110;
    },
    sdkAddress() {
      const address = this.formData.data_plane_address.trim();
      return address ? `https://49983-i8f2k1x0.${address}` : '--';
    },
    rules() {
      const maxLength = {
        validator: value => !value || value.length <= 256,
        message: this.$t('最多输入 {length} 个字符', { length: 256 }),
        trigger: 'blur',
      };
      return {
        control_plane_url: [{
          required: true,
          message: this.$t('请输入控制面地址'),
          trigger: 'blur',
        }, {
          validator: value => /^https?:\/\/[^/\s?#]+(?:[/?#]\S*)?$/i.test(value),
          message: this.$t('控制面地址必须以 http:// 或 https:// 开头'),
          trigger: 'blur',
        }, maxLength],
        data_plane_address: [{
          required: true,
          message: this.$t('请输入数据面地址'),
          trigger: 'blur',
        }, {
          validator: value => /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:\d{1,5})?$/.test(value),
          message: this.$t('数据面地址须为不带协议与路径的域名，如 e2b.example.com'),
          trigger: 'blur',
        }, maxLength],
        api_key: [{
          validator: (value) => {
            const apiKey = value.trim();
            return (this.isEdit || Boolean(apiKey)) && apiKey !== '••••••';
          },
          message: this.$t('请输入 API Key'),
          trigger: 'blur',
        }],
        namespace: [{
          required: true,
          message: this.$t('请输入命名空间'),
          trigger: 'blur',
        }],
      };
    },
  },
  watch: {
    visible(value) {
      if (!value) this.clearKey();
    },
    clusterName() {
      this.visible = false;
      this.clearKey();
    },
  },
  deactivated() {
    this.visible = false;
    this.clearKey();
  },
  beforeDestroy() {
    this.clearKey();
  },
  methods: {
    async open() {
      if (this.visible || this.submitting) return;
      const config = this.config;
      this.formData = {
        control_plane_url: config ? config.control_plane_url : '',
        data_plane_address: config ? config.data_plane_address : '',
        namespace: config ? config.namespace : 'default',
        enabled: config ? config.enabled : true,
        api_key: '',
      };
      this.editingKey = false;
      this.visible = true;
      await this.$nextTick();
      this.initSidebarFormData(this.getDraftState());
    },
    getDraftState() {
      const { control_plane_url, data_plane_address, namespace, enabled, api_key } = this.formData;
      return { control_plane_url, data_plane_address, namespace, enabled, keyChanged: Boolean(api_key) };
    },
    clearKey() {
      this.formData.api_key = '';
      this.editingKey = false;
      this.$refs.form?.clearError();
    },
    editKey() {
      if (this.isEdit && !this.editingKey) {
        this.formData.api_key = '';
        this.editingKey = true;
      }
    },
    restoreKey() {
      this.clearKey();
    },
    async handleBeforeClose() {
      if (this.submitting) return false;
      if (!this.visible) return true;
      return this.$isSidebarClosed(JSON.stringify(this.getDraftState()));
    },
    async close() {
      if (await this.handleBeforeClose()) this.visible = false;
    },
    async save() {
      if (this.submitting || !this.$refs.form) return;
      this.submitting = true;
      try {
        await this.$refs.form.validate();
      } catch (error) {
        this.submitting = false;
        return;
      }
      try {
        const { control_plane_url, data_plane_address, namespace, enabled } = this.formData;
        const data = { control_plane_url, data_plane_address, namespace, enabled };
        if (this.formData.api_key.trim()) data.api_key = this.formData.api_key.trim();
        await this.$store.dispatch('tenant/updateClusterE2bConfig', { clusterName: this.clusterName, data });
        this.$paasMessage({ theme: 'success', message: this.$t('保存成功') });
        this.visible = false;
        this.clearKey();
        this.$emit('saved', { enabled });
      } catch (error) {
        this.catchErrorHandler(error);
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style lang="scss">
.cluster-e2b-config-editor {
  .bk-sideslider-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 100vw;
    overflow: hidden;
  }
  .bk-sideslider-header {
    flex-shrink: 0;
  }
  .bk-sideslider-content {
    flex: 1;
    min-height: 0;
    max-height: none !important;
    overflow-y: auto;
  }
  .bk-sideslider-footer {
    flex-shrink: 0;
    height: auto;
    background-color: #fafbfd !important;
  }
  .editor-header {
    display: flex;
    align-items: center;
    height: 52px;
    min-width: 0;
    > span:first-child {
      flex-shrink: 0;
    }
  }
  .cluster-name {
    overflow: hidden;
    margin-left: 8px;
    padding-left: 8px;
    border-left: 1px solid #dcdee5;
    color: #979ba5;
    font-size: 12px;
    line-height: 18px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .editor-content {
    padding: 20px 36px 24px 24px;
  }
  .access-notice {
    margin-bottom: 16px;
    ol {
      margin: 4px 0 0;
      padding-left: 20px;
      line-height: 20px;
      list-style: decimal;
    }
  }
  .e2b-config-form {
    width: 635px;
    max-width: 100%;
    .bk-form-item + .bk-form-item {
      margin-top: 22px;
    }
  }
  .group-title {
    margin: 0 0 18px;
    color: #313238;
    font-size: 14px;
    font-weight: 700;
    line-height: 22px;
    &:not(:first-child) {
      margin-top: 24px;
    }
  }
  .field-hint {
    margin: 0 0 0 5px;
    color: #979ba5;
    font-size: 12px;
    line-height: 20px;
    overflow-wrap: anywhere;
  }
  .api-key-input {
    position: relative;
    &.masked-key input {
      font-size: 24px;
    }
    &.editing-key input {
      padding-right: 32px !important;
    }
  }
  .restore-key {
    position: absolute;
    top: 0;
    right: 10px;
    height: 32px;
    color: #979ba5;
    font-size: 16px;
  }
  .editor-footer {
    display: flex;
    gap: 8px;
    width: 100%;
    padding: 8px 24px;
  }
}
</style>
