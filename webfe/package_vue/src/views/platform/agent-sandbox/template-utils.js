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

// 快捷开关先带上全部可写字段，避免只提交布尔值时丢掉其余配置。
const PLATFORM_TEMPLATE_FIELDS = [
  'name', 'description', 'image', 'cpu_count', 'memory_mb', 'disk_size_mb', 'env_vars', 'workdir',
  'prewarm_count', 'enabled', 'is_public',
];

export function getTemplatePayload(detail) {
  return Object.fromEntries(PLATFORM_TEMPLATE_FIELDS.map(field => [field, detail[field]]));
}

