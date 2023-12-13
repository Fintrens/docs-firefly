<template>
    <div class="live-result-image">
      <img :src="src" :alt="alt" />
    </div>
  </template>
   
  <script>
  export default {
    props: {
      src: {
        type: String,
        required: true,
      },
      alt: {
        type: String,
        required: true,
      },
    },
  };
  </script>
   
  <style scoped>
  .live-result-image {
    max-width: 100%;
    margin: 0 auto;
    overflow: hidden;
  }

  @media screen and (min-width: 768px) {
    .live-result-image img{
      max-width: 150%;
      position: absolute;    
      left: 175px;
      display: block;
    }
  }

  @media screen and (max-width: 360px) {
    .live-result-image img{
      max-width: 100%;
    }    
  }
  </style>