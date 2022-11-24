# -*- coding: utf-8 -*-
"""
TencentBlueKing is pleased to support the open source community by making
蓝鲸智云 - PaaS 平台 (BlueKing - PaaS System) available.
Copyright (C) 2017 THL A29 Limited, a Tencent company. All rights reserved.
Licensed under the MIT License (the "License"); you may not use this file except
in compliance with the License. You may obtain a copy of the License at

    http://opensource.org/licenses/MIT

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
either express or implied. See the License for the specific language governing permissions and
limitations under the License.

We undertake not to change the open source license (MIT license) applicable
to the current version of the project delivered to anyone in the future.
"""
# Generated by Django 2.2.17 on 2020-12-09 08:47

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('modules', '0001_initial'),
        ('servicehub', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='SharedServiceAttachment',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('region', models.CharField(help_text='部署区域', max_length=32)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('updated', models.DateTimeField(auto_now=True)),
                ('service_type', models.CharField(max_length=16, verbose_name='增强服务类型')),
                ('service_id', models.UUIDField(verbose_name='增强服务 ID')),
                ('ref_attachment_pk', models.IntegerField(verbose_name='被共享的服务绑定关系主键')),
                ('module', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='modules.Module', verbose_name='发起共享的应用模块')),
            ],
            options={
                'unique_together': {('module', 'service_type', 'service_id')},
            },
        ),
        migrations.AlterUniqueTogether(
            name='serviceapplicationattachment',
            unique_together=None,
        ),
        migrations.RemoveField(
            model_name='serviceapplicationattachment',
            name='application',
        ),
        migrations.RemoveField(
            model_name='serviceapplicationattachment',
            name='service',
        ),
        migrations.DeleteModel(
            name='RemoteServiceApplicationAttachment',
        ),
        migrations.DeleteModel(
            name='ServiceApplicationAttachment',
        ),
    ]
