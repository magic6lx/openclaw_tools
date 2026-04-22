import React from 'react';
import { Typography, Card } from 'antd';

const { Title } = Typography;

function Clients() {
  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>客户端管理</Title>
      <Card>客户端列表 - 功能开发中</Card>
    </div>
  );
}

export default Clients;
