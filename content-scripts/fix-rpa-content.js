// RPA模式前端内容脚本修复
// 覆盖前端的VIP检查逻辑，强制启用RPA模式

console.log('=== RPA模式内容脚本修复 ===');

// 覆盖VIP检查函数
window.isVipUser = function() {
  return true;
};

// 覆盖VIP验证API调用
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
  const originalSendMessage = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = function(message, callback) {
    // 拦截VIP验证请求
    if (message && message.type === 'isVipUser') {
      console.log('✓ 拦截VIP验证请求，返回成功');
      if (callback && typeof callback === 'function') {
        callback({ success: true, isVip: true, message: 'VIP功能已启用' });
      }
      return Promise.resolve({ success: true, isVip: true, message: 'VIP功能已启用' });
    }
    
    // 拦截RPA状态请求
    if (message && message.type === 'getRpaStatus') {
      console.log('✓ 拦截RPA状态请求，返回启用');
      if (callback && typeof callback === 'function') {
        callback({ success: true, enabled: true, message: 'RPA模式已启用' });
      }
      return Promise.resolve({ success: true, enabled: true, message: 'RPA模式已启用' });
    }
    
    // 拦截RPA配置请求
    if (message && message.type === 'getRpaConfig') {
      console.log('✓ 拦截RPA配置请求，返回默认配置');
      if (callback && typeof callback === 'function') {
        callback({ 
          success: true, 
          config: {
            enabled: true,
            maxConcurrentTasks: 5,
            timeout: 30000,
            retryCount: 3
          }, 
          message: 'RPA配置获取成功'
        });
      }
      return Promise.resolve({ 
        success: true, 
        config: {
          enabled: true,
          maxConcurrentTasks: 5,
          timeout: 30000,
          retryCount: 3
        }, 
        message: 'RPA配置获取成功'
      });
    }
    
    // 其他请求正常处理
    return originalSendMessage.apply(chrome.runtime, arguments);
  };
}

// 覆盖前端的VIP状态检查
if (typeof window !== 'undefined') {
  window.vipStatus = {
    isVip: true,
    enabled: true,
    features: {
      rpa: true,
      vip: true,
      premium: true
    }
  };
  
  // 添加全局RPA启用标志
  window.rpaEnabled = true;
  window.rpaConfig = {
    enabled: true,
    maxConcurrentTasks: 5,
    timeout: 30000,
    retryCount: 3
  };
}

// 监听DOM加载完成事件
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM加载完成，开始修复RPA模式UI...');
  
  // 查找所有与RPA相关的元素
  const rpaElements = document.querySelectorAll('[class*="rpa"], [id*="rpa"], [name*="rpa"], [value*="rpa"]');
  console.log('找到RPA相关元素数量:', rpaElements.length);
  
  rpaElements.forEach((element, index) => {
    console.log(`元素 ${index}:`, element);
    console.log(`  类名:`, element.className);
    console.log(`  ID:`, element.id);
    console.log(`  名称:`, element.name);
    console.log(`  值:`, element.value);
    console.log(`  禁用状态:`, element.disabled);
    
    // 移除禁用状态
    if (element.disabled) {
      element.disabled = false;
      console.log(`✓ 已移除禁用状态`);
    }
    
    // 移除灰色样式
    if (element.style.opacity && parseFloat(element.style.opacity) < 0.7) {
      element.style.opacity = '1';
      console.log(`✓ 已移除灰色样式`);
    }
    
    // 移除pointer-events: none
    if (element.style.pointerEvents === 'none') {
      element.style.pointerEvents = 'auto';
      console.log(`✓ 已恢复点击事件`);
    }
  });
  
  // 查找包含RPA文本的元素
  const allElements = document.querySelectorAll('*');
  const rpaTextElements = [];
  
  allElements.forEach(element => {
    const text = element.textContent || '';
    if (text.includes('RPA') || text.includes('rpa')) {
      rpaTextElements.push(element);
    }
  });
  
  console.log('找到包含RPA文本的元素数量:', rpaTextElements.length);
  
  // 检查灰色元素
  rpaTextElements.forEach((element, index) => {
    const computedStyle = window.getComputedStyle(element);
    const opacity = computedStyle.opacity;
    const color = computedStyle.color;
    
    if ((opacity && parseFloat(opacity) < 0.7) || 
        (color && color.includes('rgb(128, 128, 128)'))) {
      console.log(`找到灰色RPA元素 ${index}:`, element);
      console.log(`  文本:`, element.textContent.trim());
      
      // 恢复正常状态
      element.style.opacity = '1';
      element.style.color = '';
      element.style.backgroundColor = '';
      element.disabled = false;
      console.log(`✓ 已恢复正常状态`);
    }
  });
  
  // 查找单选按钮组，检查是否有RPA模式选项
  const radioGroups = document.querySelectorAll('input[type="radio"]');
  const rpaRadioGroups = [];
  
  radioGroups.forEach(radio => {
    const name = radio.name;
    if (name && (name.includes('rpa') || name.includes('mode'))) {
      const group = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
      rpaRadioGroups.push({ name, elements: group });
    }
  });
  
  console.log('找到RPA相关单选按钮组数量:', rpaRadioGroups.length);
  
  rpaRadioGroups.forEach((group, index) => {
    console.log(`单选按钮组 ${index}:`, group.name);
    group.elements.forEach((radio, radioIndex) => {
      console.log(`  选项 ${radioIndex}:`, radio.value);
      console.log(`  禁用状态:`, radio.disabled);
      
      // 移除禁用状态
      if (radio.disabled) {
        radio.disabled = false;
        console.log(`  ✓ 已移除禁用状态`);
      }
      
      // 检查标签
      const label = document.querySelector(`label[for="${radio.id}"]`);
      if (label) {
        console.log(`  标签文本:`, label.textContent);
        
        // 移除标签的灰色样式
        const labelStyle = window.getComputedStyle(label);
        if (labelStyle.opacity && parseFloat(labelStyle.opacity) < 0.7) {
          label.style.opacity = '1';
          console.log(`  ✓ 已移除标签灰色样式`);
        }
      }
    });
  });
  
  console.log('\n🎉 RPA模式内容脚本修复完成！');
  console.log('✓ 已覆盖VIP检查逻辑');
  console.log('✓ 已覆盖RPA状态检查');
  console.log('✓ 已修复RPA相关UI元素');
  console.log('✓ 已启用RPA模式选项');
});

// 定期检查并修复RPA模式（每5秒）
setInterval(function() {
  console.log('定期检查RPA模式状态...');
  
  // 检查是否有新的禁用RPA元素
  const rpaElements = document.querySelectorAll('[class*="rpa"], [id*="rpa"], [name*="rpa"], [value*="rpa"]');
  let fixedCount = 0;
  
  rpaElements.forEach(element => {
    if (element.disabled) {
      element.disabled = false;
      fixedCount++;
    }
    
    if (element.style.opacity && parseFloat(element.style.opacity) < 0.7) {
      element.style.opacity = '1';
      fixedCount++;
    }
  });
  
  if (fixedCount > 0) {
    console.log(`✓ 修复了 ${fixedCount} 个RPA元素`);
  }
}, 5000);

console.log('RPA模式内容脚本修复已加载');
