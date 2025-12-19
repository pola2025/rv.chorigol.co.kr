import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  MousePointer, 
  DollarSign, 
  Target, 
  Users, 
  FileText,
  Edit,
  Save,
  X,
  Globe,
  Home
} from 'lucide-react';
import './Statistics.css';

const Statistics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [monthlyGoals, setMonthlyGoals] = useState({});
  const [editingMonth, setEditingMonth] = useState(null);
  const [goalText, setGoalText] = useState('');

  // 광고 플랫폼별 성과 데이터
  const platformData = [
    { 
      platform: '네이버', 
      cost: 500000, 
      impressions: 125000, 
      clicks: 3750,
      ctr: 3.0,
      cpc: 133,
      visitors: 2100
    },
    { 
      platform: '카카오', 
      cost: 300000, 
      impressions: 85000, 
      clicks: 2550,
      ctr: 3.0,
      cpc: 118,
      visitors: 1450
    },
    { 
      platform: '구글', 
      cost: 200000, 
      impressions: 45000, 
      clicks: 900,
      ctr: 2.0,
      cpc: 222,
      visitors: 520
    },
    { 
      platform: '페이스북', 
      cost: 150000, 
      impressions: 35000, 
      clicks: 700,
      ctr: 2.0,
      cpc: 214,
      visitors: 380
    }
  ];

  // 월별 광고 효율 추이
  const monthlyTrend = [
    { month: '1월', cost: 800000, impressions: 180000, clicks: 4500, visitors: 2800, pageviews: 8400 },
    { month: '2월', cost: 850000, impressions: 195000, clicks: 5070, visitors: 3100, pageviews: 9300 },
    