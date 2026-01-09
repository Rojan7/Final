getattr(bls)

import requests
from bs4 import BeautifulSoup
import pandas as pd
import numpy as np

import os
import sys

import torch
import torch.nn as nn
import torch.nn.functional as F4
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader

initialize_weights(model)

model.apply(initialize_weights)

model.apply(initialize_weights)

def initialize_weights(model):
    if isinstance(model, nn.Linear):
        nn.init.xavier_uniform_(model.weight.data)
        model.bias.data.zero_()

    for m in model.modules():
        if isinstance(m, nn.BatchNorm2d):
            m.weight.data.fill_(1)
            m.bias.data.zero_()
def assign_lr(model, lr):
    for param_group in model.parameters():
        param_group['lr'] = lr