<script setup lang="ts">
import {
  Activity,
  ArrowRight,
  Boxes,
  GitBranch,
  Package,
  Shield,
  Terminal,
} from '@lucide/vue'
import { withBase } from 'vitepress'
import type { Component } from 'vue'

import {
  developerPaths,
  technologyDomains,
  type DomainIcon,
} from '../home-content'

const domainIcons = {
  activity: Activity,
  boxes: Boxes,
  'git-branch': GitBranch,
  package: Package,
  shield: Shield,
  terminal: Terminal,
} satisfies Record<DomainIcon, Component>
</script>

<template>
  <main class="cloud-native-home">
    <header class="cloud-native-home__intro">
      <p class="cloud-native-home__eyebrow">云原生开发手册</p>
      <h1>应用开发者的云原生技术工作台</h1>
      <p class="cloud-native-home__lead">
        围绕交付、连通性、配置、诊断和安全，建立从代码到生产环境的技术地图。
      </p>
      <div class="cloud-native-home__summary" aria-label="内容概览">
        <span>5 条开发路径</span>
        <span>24 个技术主题</span>
        <span>1 个已完成</span>
      </div>
    </header>

    <section id="paths" class="cloud-native-home__section" aria-labelledby="paths-title">
      <div class="cloud-native-home__section-heading">
        <p class="cloud-native-home__eyebrow">工作流</p>
        <h2 id="paths-title">开发路径</h2>
      </div>
      <div class="cloud-native-home__paths">
        <article
          v-for="path in developerPaths"
          :key="path.title"
          class="cloud-native-home__path"
          :class="`cloud-native-home__path--${path.tone}`"
          data-path
        >
          <div class="cloud-native-home__path-heading">
            <h3>{{ path.title }}</h3>
            <span class="cloud-native-home__status cloud-native-home__status--planned">规划中</span>
          </div>
          <p class="cloud-native-home__steps">{{ path.steps.join(' → ') }}</p>
        </article>
      </div>
    </section>

    <section
      id="technologies"
      class="cloud-native-home__section"
      aria-labelledby="technologies-title"
    >
      <div class="cloud-native-home__section-heading">
        <p class="cloud-native-home__eyebrow">技术目录</p>
        <h2 id="technologies-title">按领域建立知识</h2>
      </div>
      <div class="cloud-native-home__domains">
        <section
          v-for="domain in technologyDomains"
          :key="domain.title"
          class="cloud-native-home__domain"
          :class="`cloud-native-home__domain--${domain.tone}`"
          data-domain
        >
          <div class="cloud-native-home__domain-heading">
            <component :is="domainIcons[domain.icon]" :size="19" aria-hidden="true" />
            <div>
              <h3>{{ domain.title }}</h3>
              <p>{{ domain.description }}</p>
            </div>
          </div>
          <div class="cloud-native-home__topics">
            <template v-for="topic in domain.topics" :key="topic.title">
              <a
                v-if="topic.status === 'available'"
                class="cloud-native-home__topic cloud-native-home__topic--available"
                :href="withBase(topic.href)"
                :data-status="topic.status"
                data-topic
              >
                <img v-if="topic.logo" :src="withBase(topic.logo)" alt="" aria-hidden="true" />
                <span class="cloud-native-home__topic-title">{{ topic.title }}</span>
                <span class="cloud-native-home__status cloud-native-home__status--available">已完成</span>
                <ArrowRight :size="16" aria-hidden="true" />
              </a>
              <div
                v-else
                class="cloud-native-home__topic cloud-native-home__topic--planned"
                :data-status="topic.status"
                data-topic
              >
                <span class="cloud-native-home__topic-title">{{ topic.title }}</span>
                <span class="cloud-native-home__status cloud-native-home__status--planned">规划中</span>
              </div>
            </template>
          </div>
        </section>
      </div>
    </section>

    <section
      class="cloud-native-home__recommended"
      data-recommended-start
      aria-labelledby="recommended-title"
    >
      <div>
        <p class="cloud-native-home__eyebrow">推荐起点</p>
        <h2 id="recommended-title">从 Kubernetes 开始</h2>
        <p>先掌握工作负载、服务和配置的核心概念，再逐步进入交付、可观测性和安全实践。</p>
      </div>
      <a :href="withBase('/kubernetes/')">
        <span>进入 Kubernetes 专题</span>
        <ArrowRight :size="17" aria-hidden="true" />
      </a>
    </section>
  </main>
</template>

<style scoped>
.cloud-native-home {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 48px 32px 64px;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-base);
  letter-spacing: 0;
}

.cloud-native-home__intro {
  max-width: 780px;
}

.cloud-native-home h1,
.cloud-native-home h2,
.cloud-native-home h3,
.cloud-native-home p {
  letter-spacing: 0;
}

.cloud-native-home h1,
.cloud-native-home h2,
.cloud-native-home h3,
.cloud-native-home p {
  margin: 0;
}

.cloud-native-home h1 {
  max-width: 650px;
  font-size: 36px;
  line-height: 1.2;
}

.cloud-native-home h2 {
  font-size: 24px;
  line-height: 1.3;
}

.cloud-native-home h3 {
  font-size: 15px;
  line-height: 1.35;
}

.cloud-native-home__eyebrow {
  margin-bottom: 8px !important;
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
}

.cloud-native-home__lead {
  max-width: 650px;
  margin-top: 14px !important;
  color: var(--vp-c-text-2);
  font-size: 16px;
  line-height: 1.65;
}

.cloud-native-home__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-top: 20px;
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.4;
}

.cloud-native-home__summary span + span {
  padding-left: 20px;
  border-left: 1px solid var(--vp-c-divider);
}

.cloud-native-home a:focus-visible {
  outline: 3px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}

.cloud-native-home__section {
  margin-top: 52px;
}

.cloud-native-home__section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.cloud-native-home__paths {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.cloud-native-home__path {
  min-width: 0;
  min-height: 164px;
  padding: 14px;
  border: 1px solid var(--vp-c-divider);
  border-top: 3px solid var(--domain-accent);
  border-radius: 5px;
  background: var(--vp-c-bg);
}

.cloud-native-home__path--green,
.cloud-native-home__domain--green { --domain-accent: #2f8a61; }
.cloud-native-home__path--blue,
.cloud-native-home__domain--blue { --domain-accent: #3978a8; }
.cloud-native-home__path--violet,
.cloud-native-home__domain--violet { --domain-accent: #76549a; }
.cloud-native-home__path--amber,
.cloud-native-home__domain--amber { --domain-accent: #a46a12; }
.cloud-native-home__path--rose,
.cloud-native-home__domain--rose { --domain-accent: #b84a5b; }
.cloud-native-home__domain--neutral { --domain-accent: #66727d; }

.cloud-native-home__path-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 8px;
}

.cloud-native-home__steps {
  margin-top: 18px !important;
  color: var(--vp-c-text-2);
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.cloud-native-home__status {
  display: inline-block;
  flex: 0 0 auto;
  padding: 2px 5px;
  border: 1px solid currentColor;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.cloud-native-home__status--planned { color: var(--vp-c-text-2); }
.cloud-native-home__status--available { color: var(--vp-c-brand-1); }

.cloud-native-home__domains {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
  margin-top: 20px;
}

.cloud-native-home__domain {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--vp-c-divider);
  border-top: 3px solid var(--domain-accent);
  border-radius: 6px;
  background: var(--vp-c-bg);
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
}

.cloud-native-home__domain-heading {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  color: var(--domain-accent);
}

.cloud-native-home__domain-heading svg {
  margin-top: 1px;
}

.cloud-native-home__domain-heading h3 {
  color: var(--vp-c-text-1);
}

.cloud-native-home__domain-heading p {
  margin-top: 4px !important;
  color: var(--vp-c-text-2);
  font-size: 12px;
  line-height: 1.45;
}

.cloud-native-home__topics {
  display: grid;
  gap: 0;
  margin-top: 13px;
}

.cloud-native-home__topic {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 38px;
  padding: 9px 0;
  font-size: 13px;
  line-height: 1.25;
  text-decoration: none;
}

.cloud-native-home__topic + .cloud-native-home__topic {
  border-top: 1px solid color-mix(in srgb, var(--vp-c-divider) 58%, transparent);
}

.cloud-native-home__topic--planned {
  color: var(--vp-c-text-2);
}

.cloud-native-home__topic--available {
  grid-template-columns: 20px minmax(0, 1fr) auto 16px;
  color: var(--vp-c-text-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 7%, var(--vp-c-bg));
}

.cloud-native-home__topic--available:hover {
  color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 12%, var(--vp-c-bg));
}

.cloud-native-home__topic img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.cloud-native-home__topic-title {
  min-width: 0;
  overflow-wrap: anywhere;
}

.cloud-native-home__recommended {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  margin-top: 56px;
  padding: 24px 0;
  border-top: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
}

.cloud-native-home__recommended p:not(.cloud-native-home__eyebrow) {
  max-width: 650px;
  margin-top: 8px !important;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.6;
}

.cloud-native-home__recommended a {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  color: var(--vp-c-brand-1);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
  text-decoration: none;
}

.cloud-native-home__recommended a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 1100px) {
  .cloud-native-home__paths {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cloud-native-home__domains {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .cloud-native-home {
    padding: 32px 18px 48px;
  }

  .cloud-native-home h1 {
    font-size: 28px;
  }

  .cloud-native-home__summary {
    display: grid;
    gap: 6px;
  }

  .cloud-native-home__summary span + span {
    padding-left: 0;
    border-left: 0;
  }

  .cloud-native-home__paths,
  .cloud-native-home__domains {
    grid-template-columns: minmax(0, 1fr);
  }

  .cloud-native-home__path {
    min-height: 0;
  }

  .cloud-native-home__recommended {
    display: grid;
    align-items: start;
  }
}
</style>
