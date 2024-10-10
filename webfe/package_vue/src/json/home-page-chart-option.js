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
 * @file 首页告警情况 echarts 图表配置
 */

export default function (data, color) {
  return {
    tooltip: {
      trigger: 'item',
      formatter(params) {
        return `${params.name}\n${params.value}`;
      },
    },
    legend: {
      orient: 'vertical',
      right: '15%',
      top: 'middle',
      itemHeight: 10,
      textStyle: {
        color: '#63656E',
        fontSize: 12,
        padding: [3, 0, 0, 0],
      },
      icon: 'circle',
      data: data.map(d => d.name),
      formatter(name) {
        // 找到对应名称的数据项
        const item = data.find(d => d.name === name);
        return `${name}：${item.value}`;
      },
    },
    color,
    series: [
      {
        type: 'pie',
        center: ['40%', '50%'],
        radius: ['50%', '70%'],
        avoidLabelOverlap: false,
        label: {
          normal: {
            show: false,
            position: 'center',
          },
          // 内部显示
          emphasis: {
            show: true,
            // 使用换行符和制表符简单格式化文本
            formatter: params => `{value|${params.value}}\n{name|${params.name}}`,
            textStyle: {
              align: 'center', // 确保整个文本块居中
              verticalAlign: 'middle', // 确保整个文本块垂直居中
              rich: {
                value: {
                  fontSize: 28,
                  fontWeight: 'bold',
                  color: '#EA3636',
                  align: 'center', // 确保数值部分居中
                  lineHeight: 40,
                },
                name: {
                  fontSize: 12,
                  color: '#63656E',
                  align: 'center', // 确保名称部分居中
                },
              },
            },
          },
        },
        labelLine: {
          normal: {
            show: false,
          },
        },
        data,
      },
    ],
  };
}
