<template>
  <div class="container">
    <h1>Test Two</h1>
    <p>这是一个Vue项目，使用了禁止商用字体</p>
    <div class="font-showcase">
      <p class="commercial-font">商业字体示例文字 - 仅供个人使用</p>
    </div>
  </div>
</template>

<script setup>
</script>

<style>
.container {
  font-family: 'Noto Sans SC', sans-serif;
  padding: 20px;
}

.commercial-font {
  font-family: 'SimHei', 'Microsoft YaHei', sans-serif;
  font-size: 24px;
  margin-top: 20px;
}
</style>
