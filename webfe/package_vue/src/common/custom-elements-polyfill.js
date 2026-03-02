/*
 * TencentBlueKing is pleased to support the open source community by making
 * 蓝鲸智云 - PaaS 平台 (BlueKing - PaaS System) available.
 * Copyright (C) 2017 THL A29 Limited, a Tencent company. All rights reserved.
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

/**
 * 防止 customElements.define 重复注册同名元素时抛出 NotSupportedError。
 * 某些第三方库在模块顶层直接调用
 * customElements.define()，当模块被打包到多个 chunk 或 HMR 重新执行时，
 * 会导致重复注册报错。此补丁确保同名元素只注册一次。
 */
const originalDefine = customElements.define.bind(customElements);
customElements.define = (name, constructor, options) => {
  if (!customElements.get(name)) {
    originalDefine(name, constructor, options);
  }
};
