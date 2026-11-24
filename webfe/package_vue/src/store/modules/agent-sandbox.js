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

import http from '@/api';

// Components discard stale results when the application changes. Let requests settle
// so that creating a key can always remove the response from the shared HTTP cache.
const requestConfig = {
  fromCache: false,
  cancelPrevious: false,
  cancelWhenRouteChange: false,
};

/**
 * 拼装应用下 Agent 沙箱相关接口的基础地址
 * @param {string} appCode - 应用 Code
 * @returns {string} 接口基础地址
 */
function consoleUrl(appCode) {
  return `${BACKEND_URL}/api/bkapps/applications/${encodeURIComponent(appCode)}/agent_sandbox/e2b/`;
}

export default {
  namespaced: true,
  actions: {
    /**
     * 查询沙箱实例列表
     * @param {string} appCode - 应用 Code
     * @param {string} [templateId] - 模板 ID，传入时只返回该模板下的沙箱
     */
    listSandboxes({}, { appCode, templateId = '' }) {
      return http.get(`${consoleUrl(appCode)}sandboxes/`, {}, {
        ...requestConfig,
        params: templateId ? { template_id: templateId } : {},
      });
    },
    /**
     * 销毁（删除）指定沙箱实例
     * @param {string} appCode - 应用 Code
     * @param {string} sandboxId - 沙箱实例 ID
     */
    destroySandbox({}, { appCode, sandboxId }) {
      return http.delete(`${consoleUrl(appCode)}sandboxes/${encodeURIComponent(sandboxId)}`, {}, requestConfig);
    },
    /**
     * 获取沙箱模板列表（含内置模板与当前应用的自建模板）
     * @param {string} appCode - 应用 Code
     */
    listTemplates({}, { appCode }) {
      return http.get(`${consoleUrl(appCode)}templates/`, {}, requestConfig);
    },
    /**
     * 获取沙箱模板详情
     * @param {string} appCode - 应用 Code
     * @param {string} templateId - 模板 ID
     */
    getTemplate({}, { appCode, templateId }) {
      return http.get(`${consoleUrl(appCode)}templates/${encodeURIComponent(templateId)}`, {}, requestConfig);
    },
    /**
     * 新建沙箱模板
     * @param {string} appCode - 应用 Code
     * @param {Object} params - 模板配置（template_id、spec 等）
     */
    createTemplate({}, { appCode, params }) {
      return http.post(`${consoleUrl(appCode)}templates/`, params, requestConfig);
    },
    /**
     * 更新沙箱模板
     * @param {string} appCode - 应用 Code
     * @param {string} templateId - 模板 ID
     * @param {Object} params - 模板配置
     */
    updateTemplate({}, { appCode, templateId, params }) {
      return http.put(`${consoleUrl(appCode)}templates/${encodeURIComponent(templateId)}`, params, requestConfig);
    },
    /**
     * 删除沙箱模板
     * @param {string} appCode - 应用 Code
     * @param {string} templateId - 模板 ID
     */
    deleteTemplate({}, { appCode, templateId }) {
      return http.delete(`${consoleUrl(appCode)}templates/${encodeURIComponent(templateId)}`, {}, requestConfig);
    },
    /**
     * 获取 API Key 列表
     * @param {string} appCode - 应用 Code
     */
    listApiKeys({}, { appCode }) {
      return http.get(`${consoleUrl(appCode)}api_keys/`, {}, requestConfig);
    },
    /**
     * 新建 API Key，返回结果中包含仅展示一次的明文 Key
     * @param {string} appCode - 应用 Code
     * @param {string} name - API Key 名称
     */
    async createApiKey({}, { appCode, name }) {
      const url = `${consoleUrl(appCode)}api_keys/`;
      const requestId = `post_${url}`;
      try {
        return await http.post(url, { name }, { ...requestConfig, requestId });
      } finally {
        // fromCache:false only disables reads; the shared client still caches POST responses.
        await http.cancelCache(requestId);
      }
    },
    /**
     * 吊销指定 API Key
     * @param {string} appCode - 应用 Code
     * @param {string} uuid - API Key 唯一标识
     */
    revokeApiKey({}, { appCode, uuid }) {
      return http.delete(`${consoleUrl(appCode)}api_keys/${encodeURIComponent(uuid)}`, {}, requestConfig);
    },
  },
};
