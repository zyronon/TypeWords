let RESOURCE_URL = 'https://libs.typewords.cc/'
  //51.la
;(function () {
  window.LA = window.LA || {
    ids: [{id: '3OH8ITYRgwzo58L2', ck: '3OH8ITYRgwzo58L2'}],
    id: '3OH8ITYRgwzo58L2',
    ck: '3OH8ITYRgwzo58L2',
    hashMode: true,
  }
  const script = document.createElement('script')
  script.src = RESOURCE_URL + `51.js`
  // script.src = 'https://sdk.51.la/js-sdk-pro.min.js'
  document.head.appendChild(script)
})()

// baidu
var _hmt = _hmt || []
;(function () {
  var hm = document.createElement('script')
  hm.src = 'https://hm.baidu.com/hm.js?3dae52fcd5375a19905462e4ad3eb54e'
  document.head.appendChild(hm)
})()

// umami
// ;(function () {
//   var umami2 = document.createElement('script')
//   umami2.src = ENV.RESOURCE_URL + 'libs/pb.js'
//   umami2.setAttribute('data-website-id', '160308c9-7900-4b1d-a0b1-c3b25a9530f6')
//   document.head.appendChild(umami2)
// })()

// umami-saas
;(function () {
  var umami2 = document.createElement('script')
  umami2.src = RESOURCE_URL + '/s.js'
  // umami2.setAttribute('data-website-id', '03102800-e8e8-40a2-addf-9999d5e5c525')
  umami2.setAttribute('data-website-id', 'ee7c7703-4f16-4e2c-8a75-d4679e7e9ad4')
  umami2.setAttribute('data-host-url', 'https://um.typewords.cc/')
  umami2.setAttribute('data-do-not-track', false)
  document.head.appendChild(umami2)
})()

